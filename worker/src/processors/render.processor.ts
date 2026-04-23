import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../services/storage.service';
import { TtsService } from '../services/tts.service';
import { NoFacePipeline } from '../pipelines/no-face.pipeline';
import { AvatarPipeline } from '../pipelines/avatar.pipeline';

export interface RenderJobData {
  projectId: string;
  renderingId: string;
  userId: string;
  mode: 'NO_FACE' | 'AVATAR';
}

export class RenderProcessor {
  private storageService: StorageService;
  private ttsService: TtsService;

  constructor(private readonly prisma: PrismaClient) {
    this.storageService = new StorageService();
    this.ttsService = new TtsService();
  }

  async process(job: Job<RenderJobData>): Promise<void> {
    const { projectId, renderingId, mode } = job.data;
    const workDir = this.getTempDir(renderingId);

    console.log(`[RenderProcessor] ▶ Job ${job.id} | renderingId=${renderingId} | projectId=${projectId} | mode=${mode}`);

    try {
      // ── Step 1: Mark PROCESSING ──────────────────────────────────────────
      await this.prisma.rendering.update({
        where: { id: renderingId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 0,
        },
      });

      // ── Step 2: Load full project ────────────────────────────────────────
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          script: true,
          scenes: { orderBy: { order: 'asc' } },
          slides: { orderBy: { order: 'asc' } },
          voiceConfig: true,
          avatar: true,
        },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found in database`);
      }
      if (!project.script) {
        throw new Error('Project has no script. Please add a script before rendering.');
      }
      if (project.scenes.length === 0) {
        throw new Error('Project has no scenes. Please parse the script into scenes first.');
      }

      // ── Step 3: Progress callback ─────────────────────────────────────────
      const onProgress = async (pct: number) => {
        const clamped = Math.min(Math.round(pct), 99);
        await this.prisma.rendering.update({
          where: { id: renderingId },
          data: { progress: clamped },
        });
        await job.updateProgress(clamped);
        console.log(`[RenderProcessor] Progress: ${clamped}%`);
      };

      // ── Step 4: Run pipeline ──────────────────────────────────────────────
      let videoPath: string;
      let duration: number;

      if (mode === 'NO_FACE') {
        const pipeline = new NoFacePipeline(this.prisma, this.storageService, this.ttsService);
        ({ videoPath, duration } = await pipeline.execute(project, workDir, onProgress));
      } else {
        const pipeline = new AvatarPipeline(this.prisma, this.storageService, this.ttsService);
        ({ videoPath, duration } = await pipeline.execute(project, workDir, onProgress));
      }

      // ── Step 5: Validate output file ──────────────────────────────────────
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Pipeline finished but output file is missing: ${videoPath}`);
      }

      const fileStats = fs.statSync(videoPath);
      if (fileStats.size === 0) {
        throw new Error('Output video file is 0 bytes — pipeline produced empty file');
      }

      console.log(
        `[RenderProcessor] Output OK → ${videoPath} | ` +
        `size=${(fileStats.size / 1024 / 1024).toFixed(1)}MB | ` +
        `duration=${duration.toFixed(1)}s`,
      );

      // ── Step 6: Upload to storage ─────────────────────────────────────────
      await onProgress(99);

      const videoKey = `projects/${projectId}/videos/${renderingId}/final.mp4`;
      const videoUrl = await this.storageService.uploadFromPath(
        videoKey,
        videoPath,
        'video/mp4',
      );

      if (!videoUrl) {
        throw new Error('Storage upload returned empty URL — check MinIO/S3 config');
      }

      console.log(`[RenderProcessor] Uploaded → ${videoUrl}`);

      // ── Step 7: Mark COMPLETED with videoUrl ──────────────────────────────
      // THIS is the critical step — writes videoUrl into the rendering row
      // so the frontend can pick it up on the next status poll
      await this.prisma.rendering.update({
        where: { id: renderingId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          videoKey,
          videoUrl,           // ← frontend reads this field
          duration,
          fileSize: BigInt(fileStats.size),
          completedAt: new Date(),
        },
      });

      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });

      console.log(`[RenderProcessor] ✓ COMPLETED | renderingId=${renderingId} | url=${videoUrl}`);

    } catch (err) {
      const message = (err as Error).message || 'Unknown error';
      console.error(`[RenderProcessor] ✗ FAILED | renderingId=${renderingId} | error=${message}`);

      // Write failure into DB so frontend shows error state (not stuck on loading)
      await this.prisma.rendering
        .update({
          where: { id: renderingId },
          data: {
            status: 'FAILED',
            errorMessage: message.substring(0, 1000),
            completedAt: new Date(),
          },
        })
        .catch((dbErr) =>
          console.error('[RenderProcessor] Could not update FAILED status in DB:', dbErr),
        );

      await this.prisma.project
        .update({
          where: { id: projectId },
          data: { status: 'FAILED' },
        })
        .catch(() => {});

      // Re-throw so BullMQ marks the job as failed and triggers retry if configured
      throw err;

    } finally {
      this.cleanup(workDir);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getTempDir(renderingId: string): string {
    const base = process.env.FFMPEG_TEMP_DIR || '/tmp/edu-video';
    const dir = path.join(base, renderingId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private cleanup(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[RenderProcessor] Cleaned up: ${dir}`);
    } catch (err) {
      console.warn(`[RenderProcessor] Cleanup warning: ${(err as Error).message}`);
    }
  }
}
