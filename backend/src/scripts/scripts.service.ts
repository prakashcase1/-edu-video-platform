import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedScene {
  order: number;
  scriptText: string;
  estimatedDuration: number;
  slideHint?: string;
}

@Injectable()
export class ScriptsService {
  private readonly logger = new Logger(ScriptsService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async upsertScript(projectId: string, userId: string, content: string) {
    await this.validateOwnership(projectId, userId);

    const script = await this.prisma.script.upsert({
      where: { projectId },
      update: { content },
      create: { content, projectId },
    });

    this.logger.log(`Script saved for project ${projectId}`);
    return script;
  }

  async getScript(projectId: string, userId: string) {
    await this.validateOwnership(projectId, userId);
    const script = await this.prisma.script.findUnique({ where: { projectId } });
    if (!script) throw new NotFoundException('Script not found');
    return script;
  }

  async parseScript(projectId: string, userId: string) {
    await this.validateOwnership(projectId, userId);

    const script = await this.prisma.script.findUnique({ where: { projectId } });
    if (!script) throw new NotFoundException('No script found. Please add a script first.');

    this.logger.log(`Parsing script for project ${projectId}`);

    let scenes: ParsedScene[];

    if (this.openai) {
      scenes = await this.parseWithOpenAI(script.content);
    } else {
      scenes = this.parseWithFallback(script.content);
    }

    // Delete existing scenes and recreate
    await this.prisma.scene.deleteMany({ where: { projectId } });

    const createdScenes = await Promise.all(
      scenes.map((scene) =>
        this.prisma.scene.create({
          data: {
            order: scene.order,
            scriptText: scene.scriptText,
            duration: scene.estimatedDuration,
            projectId,
          },
        }),
      ),
    );

    // Auto-assign slides to scenes if slides exist
    const slides = await this.prisma.slide.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    if (slides.length > 0) {
      await this.autoAssignSlides(createdScenes, slides);
    }

    this.logger.log(`Script parsed into ${createdScenes.length} scenes`);
    return { scenes: createdScenes, totalScenes: createdScenes.length };
  }

  async mapSceneToSlide(projectId: string, userId: string, sceneId: string, slideId: string | null) {
    await this.validateOwnership(projectId, userId);

    const scene = await this.prisma.scene.findFirst({ where: { id: sceneId, projectId } });
    if (!scene) throw new NotFoundException('Scene not found');

    if (slideId) {
      const slide = await this.prisma.slide.findFirst({ where: { id: slideId, projectId } });
      if (!slide) throw new NotFoundException('Slide not found');

      await this.prisma.slide.update({
        where: { id: slideId },
        data: { sceneId },
      });
    }

    return this.prisma.scene.findUnique({ where: { id: sceneId } });
  }

  async getScriptMappings(projectId: string, userId: string) {
    await this.validateOwnership(projectId, userId);

    const [scenes, slides] = await Promise.all([
      this.prisma.scene.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        include: { slides: true },
      }),
      this.prisma.slide.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
    ]);

    return { scenes, slides };
  }

  private async parseWithOpenAI(scriptContent: string): Promise<ParsedScene[]> {
    const prompt = `You are an educational video script parser. Split the following script into logical scenes/segments for a video presentation.

For each scene, provide:
1. The script text for that scene (a logical paragraph or topic chunk)
2. Estimated speaking duration in seconds (assuming ~150 words per minute)
3. A brief slide hint describing what the slide for this scene should show

Return ONLY a valid JSON array with no additional text:
[
  {
    "order": 1,
    "scriptText": "...",
    "estimatedDuration": 30,
    "slideHint": "..."
  }
]

Script to parse:
${scriptContent}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('openai.model', 'gpt-4o-mini'),
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      const parsed = JSON.parse(content);
      return parsed.scenes || parsed;
    } catch (error) {
      this.logger.error('OpenAI parsing failed, using fallback', error);
      return this.parseWithFallback(scriptContent);
    }
  }

  private parseWithFallback(scriptContent: string): ParsedScene[] {
    // Split by double newlines (paragraphs) or sentence groups
    const paragraphs = scriptContent
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    if (paragraphs.length === 0) {
      // Split by sentences if no paragraphs
      const sentences = scriptContent.match(/[^.!?]+[.!?]+/g) || [scriptContent];
      const chunkSize = Math.ceil(sentences.length / Math.max(1, Math.floor(sentences.length / 3)));
      
      const chunks: string[] = [];
      for (let i = 0; i < sentences.length; i += chunkSize) {
        chunks.push(sentences.slice(i, i + chunkSize).join(' ').trim());
      }

      return chunks.map((text, index) => ({
        order: index + 1,
        scriptText: text,
        estimatedDuration: Math.ceil((text.split(' ').length / 150) * 60),
      }));
    }

    return paragraphs.map((text, index) => ({
      order: index + 1,
      scriptText: text,
      estimatedDuration: Math.ceil((text.split(' ').length / 150) * 60),
    }));
  }

  private async autoAssignSlides(scenes: any[], slides: any[]) {
    // Distribute slides evenly across scenes
    const slidesPerScene = Math.ceil(slides.length / scenes.length);

    for (let i = 0; i < scenes.length; i++) {
      const slideStart = i * slidesPerScene;
      const sceneSlides = slides.slice(slideStart, slideStart + slidesPerScene);

      if (sceneSlides.length > 0) {
        await Promise.all(
          sceneSlides.map((slide) =>
            this.prisma.slide.update({
              where: { id: slide.id },
              data: { sceneId: scenes[i].id },
            }),
          ),
        );
      }
    }
  }

  private async validateOwnership(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');
    return project;
  }
}
