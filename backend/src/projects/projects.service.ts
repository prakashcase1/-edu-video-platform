import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  SetAvatarConfigDto,
  SetVoiceConfigDto,
  ProjectQueryDto,
} from './dto/project.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private serializeBigInt(data: any) {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        mode: dto.mode || 'NO_FACE',
        userId,
      },
      include: this.projectIncludes(),
    });

    this.logger.log(`Project created: ${project.id} by user ${userId}`);
    return this.serializeBigInt(project);
  }

  async findAll(userId: string, query: ProjectQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { slides: true, scenes: true } },
          renderings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return this.serializeBigInt({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.projectIncludes(),
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');

    return this.serializeBigInt(project);
  }

  async findByShareToken(shareToken: string) {
    const project = await this.prisma.project.findUnique({
      where: { shareToken },
      include: {
        renderings: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        voiceConfig: true,
        avatar: true,
      },
    });

    if (!project) throw new NotFoundException('Shared project not found');

    return this.serializeBigInt(project);
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    await this.validateOwnership(projectId, userId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: dto,
      include: this.projectIncludes(),
    });

    return this.serializeBigInt(updated);
  }

  async delete(projectId: string, userId: string) {
    await this.validateOwnership(projectId, userId);

    const slides = await this.prisma.slide.findMany({ where: { projectId } });
    const scenes = await this.prisma.scene.findMany({ where: { projectId } });
    const renderings = await this.prisma.rendering.findMany({
      where: { projectId },
    });

    const deletePromises = [
      ...slides.map((s) =>
        this.storageService.deleteFile(s.storageKey).catch(() => {}),
      ),
      ...scenes
        .filter((s) => s.audioKey)
        .map((s) =>
          this.storageService.deleteFile(s.audioKey as string).catch(() => {}),
        ),
      ...renderings
        .filter((r) => r.videoKey)
        .map((r) =>
          this.storageService.deleteFile(r.videoKey as string).catch(() => {}),
        ),
    ];

    await Promise.all(deletePromises);

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { message: 'Project deleted successfully' };
  }

  async setAvatarConfig(
    projectId: string,
    userId: string,
    dto: SetAvatarConfigDto,
  ) {
    await this.validateOwnership(projectId, userId);

    const result = await this.prisma.avatarConfig.upsert({
      where: { projectId },
      update: dto,
      create: {
        ...dto,
        projectId,
      },
    });

    return this.serializeBigInt(result);
  }

  async setVoiceConfig(
    projectId: string,
    userId: string,
    dto: SetVoiceConfigDto,
  ) {
    await this.validateOwnership(projectId, userId);

    const result = await this.prisma.voiceConfig.upsert({
      where: { projectId },
      update: dto,
      create: {
        ...dto,
        projectId,
      },
    });

    return this.serializeBigInt(result);
  }

  async uploadSlides(
    projectId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    await this.validateOwnership(projectId, userId);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const existingCount = await this.prisma.slide.count({
      where: { projectId },
    });

    const slides = await Promise.all(
      files.map(async (file, index) => {
        const storageKey = `projects/${projectId}/slides/${uuidv4()}-${file.originalname}`;

        const url = await this.storageService.uploadFile(
          storageKey,
          file.buffer,
          file.mimetype,
        );

        return this.prisma.slide.create({
          data: {
            filename: file.originalname,
            storageKey,
            url,
            order: existingCount + index + 1,
            projectId,
          },
        });
      }),
    );

    return this.serializeBigInt(slides);
  }

  async reorderSlides(
    projectId: string,
    userId: string,
    slideOrder: { id: string; order: number }[],
  ) {
    await this.validateOwnership(projectId, userId);

    await Promise.all(
      slideOrder.map(({ id, order }) =>
        this.prisma.slide.update({
          where: { id },
          data: { order },
        }),
      ),
    );

    const slides = await this.prisma.slide.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    return this.serializeBigInt(slides);
  }

  async deleteSlide(projectId: string, userId: string, slideId: string) {
    await this.validateOwnership(projectId, userId);

    const slide = await this.prisma.slide.findFirst({
      where: {
        id: slideId,
        projectId,
      },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    await this.storageService.deleteFile(slide.storageKey).catch(() => {});

    await this.prisma.slide.delete({
      where: { id: slideId },
    });

    return { message: 'Slide deleted successfully' };
  }

  async generateShareLink(projectId: string, userId: string) {
    await this.validateOwnership(projectId, userId);

    const shareToken = uuidv4();

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { shareToken },
    });

    return this.serializeBigInt({
      shareToken,
      project,
    });
  }

  private async validateOwnership(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId)
      throw new ForbiddenException('Access denied');

    return project;
  }

  private projectIncludes() {
    return {
      script: true,
      slides: {
        orderBy: { order: 'asc' as const },
      },
      scenes: {
        orderBy: { order: 'asc' as const },
      },
      avatar: true,
      voiceConfig: true,
      renderings: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    };
  }
}