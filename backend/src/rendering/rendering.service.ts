import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';                        // FIX 1: was `@nestjs/bullmq` — not installed
import { PrismaClient, RenderingStatus } from '@prisma/client'; // FIX 2: import enum for type safety
import { RenderJobData } from './rendering.processor';

// ─── Redis config (same values the processor uses) ────────────────────────────
const REDIS_HOST     = process.env.REDIS_HOST     || 'localhost';
const REDIS_PORT     = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const RENDER_QUEUE   = 'render-queue';

const prisma = new PrismaClient();

// FIX 1: `@nestjs/bullmq` is not installed — the project uses raw `bullmq` +
//         a custom QueueModule.  Instantiate Queue directly instead of using
//         @InjectQueue(), which requires the @nestjs/bullmq package.
//
// FIX 2: Prisma enum values must come from `RenderingStatus` imported from
//         '@prisma/client'.  Passing plain strings like 'PENDING' causes
//         TS2322 because Prisma's generated types only accept the enum type.
//
// FIX 3: `userId` does not exist on the Rendering model in the Prisma schema,
//         so it cannot appear in RenderingWhereInput.  Ownership is verified
//         by checking the parent Project instead.

@Injectable()
export class RenderingService {
  private readonly queue: Queue<RenderJobData>;

  constructor() {
    // Create the BullMQ Queue with the same Redis connection the worker uses
    this.queue = new Queue<RenderJobData>(RENDER_QUEUE, {
      connection: {
        host:     REDIS_HOST,
        port:     REDIS_PORT,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: null,
      },
    });
  }

  // ─── Start rendering ────────────────────────────────────────────────────────
  async startRendering(projectId: string, userId: string) {
    // Verify ownership via Project (Rendering has no direct userId column)
    const project = await prisma.project.findFirst({
      where:   { id: projectId, userId },
      include: { scenes: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.scenes.length) throw new BadRequestException('Project has no scenes to render');

    // Block duplicate in-progress renders
    const active = await prisma.rendering.findFirst({
      where: {
        projectId,
        status: { in: [RenderingStatus.QUEUED, RenderingStatus.PROCESSING] },
      },
    });
    if (active) throw new BadRequestException('A rendering is already in progress');

    // Create rendering record
    const rendering = await prisma.rendering.create({
      data: {
        projectId,
        status:   RenderingStatus.QUEUED,
        progress: 0,
      },
    });

    // Enqueue BullMQ job
    await this.queue.add(
      'render',
      {
        projectId,
        renderingId: rendering.id,
        userId,
        mode: (project as any).mode ?? 'NO_FACE',
      } satisfies RenderJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { renderingId: rendering.id, status: rendering.status };
  }

  // ─── Get current status ─────────────────────────────────────────────────────
  // FIX 3: removed `userId` from where — not a column on Rendering.
  //         Ownership is still enforced: we first confirm the project belongs
  //         to this user, then fetch the latest rendering for that project.
  async getRenderingStatus(projectId: string, userId: string) {
    await this.assertProjectOwner(projectId, userId);

    const rendering = await prisma.rendering.findFirst({
      where:   { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!rendering) throw new NotFoundException('No rendering found for this project');
    return this.serializeRendering(rendering);
  }

  // ─── Get history ────────────────────────────────────────────────────────────
  // FIX 3: same — userId removed from Rendering query
  async getRenderingHistory(projectId: string, userId: string) {
    await this.assertProjectOwner(projectId, userId);

    const renderings = await prisma.rendering.findMany({
      where:   { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return renderings.map(r => this.serializeRendering(r));
  }

  private serializeRendering(r: any) {
    return { ...r, fileSize: r.fileSize != null ? r.fileSize.toString() : null };
  }

  // ─── Cancel active rendering ────────────────────────────────────────────────
  async cancelRendering(projectId: string, userId: string) {
    await this.assertProjectOwner(projectId, userId);

    const rendering = await prisma.rendering.findFirst({
      where: {
        projectId,
        status: { in: [RenderingStatus.QUEUED, RenderingStatus.PROCESSING] },
      },
    });
    if (!rendering) throw new NotFoundException('No active rendering to cancel');

    // Remove from BullMQ queue if still waiting
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);
    for (const job of jobs) {
      if (job.data.renderingId === rendering.id) {
        await job.remove().catch(() => {});
        break;
      }
    }

    await prisma.rendering.update({
      where: { id: rendering.id },
      data:  {
        status:       RenderingStatus.FAILED,  // FIX 2
        errorMessage: 'Cancelled by user',
        completedAt:  new Date(),
      },
    });

    return { cancelled: true, renderingId: rendering.id };
  }

  // ─── Shared ownership guard ─────────────────────────────────────────────────
  private async assertProjectOwner(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');
  }
}