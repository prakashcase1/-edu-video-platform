import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const RENDER_QUEUE = 'render-queue';
const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './uploads';
const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL || 'http://localhost:3000';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[RenderWorker] ${new Date().toISOString()} - ${msg}`);
}

async function updateRendering(
  renderingId: string,
  status: string,
  progress: number,
  extra: Record<string, any> = {},
) {
  await prisma.rendering.update({
    where: { id: renderingId },
    data: { status: status as any, progress, ...extra },
  });
}

async function updateProjectStatus(projectId: string, status: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status: status as any },
  });
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Simulate audio generation (replace with ElevenLabs when ready) ──────────
async function simulateAudioGeneration(
  sceneId: string,
  scriptText: string,
  outputDir: string,
): Promise<{ audioKey: string; audioDuration: number }> {
  // Simulate processing delay (100ms per word)
  const words = scriptText.split(' ').length;
  await new Promise((r) => setTimeout(r, Math.min(words * 100, 3000)));

  const audioKey = `audio/${sceneId}.mp3`;
  const audioPath = path.join(outputDir, `${sceneId}.mp3`);

  // Write a placeholder file (real impl: save ElevenLabs audio bytes here)
  fs.writeFileSync(audioPath, Buffer.from(`SIMULATED_AUDIO_FOR_SCENE_${sceneId}`));

  const estimatedDuration = Math.ceil(words / 2.5); // ~150 words per minute
  return { audioKey, audioDuration: estimatedDuration };
}

// ─── Simulate video assembly (replace with FFmpeg when ready) ────────────────
async function simulateVideoAssembly(
  projectId: string,
  renderingId: string,
  outputDir: string,
): Promise<{ videoKey: string; videoUrl: string; duration: number; fileSize: bigint }> {
  // Simulate FFmpeg processing time
  await new Promise((r) => setTimeout(r, 3000));

  const videoKey = `projects/${projectId}/renders/${renderingId}.mp4`;
  const videoPath = path.join(outputDir, `${renderingId}.mp4`);

  ensureDir(path.dirname(videoPath));

  // Write a placeholder file (real impl: FFmpeg output goes here)
  const placeholderContent = Buffer.from(
    `SIMULATED_VIDEO_RENDER_${renderingId}_PROJECT_${projectId}`,
  );
  fs.writeFileSync(videoPath, placeholderContent);

  const videoUrl = `${STORAGE_BASE_URL}/uploads/${videoKey}`;
  return {
    videoKey,
    videoUrl,
    duration: 120, // placeholder 2 min duration
    fileSize: BigInt(placeholderContent.length),
  };
}

// ─── Main render job processor ───────────────────────────────────────────────
async function processRenderJob(job: Job) {
  const { projectId, renderingId, userId, mode } = job.data;

  log(`Starting render job ${renderingId} for project ${projectId} (mode: ${mode})`);

  try {
    // ── Step 1: Initialize (5%) ──────────────────────────────────────────────
    await updateRendering(renderingId, 'PROCESSING', 5, { startedAt: new Date() });
    await updateProjectStatus(projectId, 'PROCESSING');
    await job.updateProgress(5);
    log(`[${renderingId}] Step 1/5: Initialized`);

    // ── Step 2: Load project data (10%) ─────────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scenes: { orderBy: { order: 'asc' } },
        slides: { orderBy: { order: 'asc' } },
        voiceConfig: true,
        avatar: true,
        script: true,
      },
    });

    if (!project) throw new Error(`Project ${projectId} not found`);
    if (!project.scenes.length) throw new Error('No scenes found for project');

    await updateRendering(renderingId, 'PROCESSING', 10);
    await job.updateProgress(10);
    log(`[${renderingId}] Step 2/5: Loaded project with ${project.scenes.length} scenes`);

    // ── Step 3: Generate audio for each scene (10% → 60%) ───────────────────
    const audioOutputDir = path.join(STORAGE_PATH, 'audio');
    ensureDir(audioOutputDir);

    const sceneCount = project.scenes.length;
    const audioProgressPerScene = 50 / sceneCount;

    for (let i = 0; i < sceneCount; i++) {
      const scene = project.scenes[i];
      const currentProgress = 10 + Math.round(i * audioProgressPerScene);

      log(`[${renderingId}] Generating audio for scene ${i + 1}/${sceneCount}`);

      const { audioKey, audioDuration } = await simulateAudioGeneration(
        scene.id,
        scene.scriptText || `Scene ${i + 1}`,
        audioOutputDir,
      );

      // Update scene with audio info
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          audioKey,
          duration: audioDuration,
        },
      });

      await updateRendering(renderingId, 'PROCESSING', currentProgress);
      await job.updateProgress(currentProgress);
    }

    await updateRendering(renderingId, 'PROCESSING', 60);
    await job.updateProgress(60);
    log(`[${renderingId}] Step 3/5: Audio generation complete`);

    // ── Step 4: Assemble video (60% → 90%) ──────────────────────────────────
    log(`[${renderingId}] Step 4/5: Assembling video...`);
    await updateRendering(renderingId, 'PROCESSING', 65);
    await job.updateProgress(65);

    const renderOutputDir = path.join(STORAGE_PATH, 'projects', projectId, 'renders');
    ensureDir(renderOutputDir);

    const { videoKey, videoUrl, duration, fileSize } = await simulateVideoAssembly(
      projectId,
      renderingId,
      renderOutputDir,
    );

    await updateRendering(renderingId, 'PROCESSING', 90);
    await job.updateProgress(90);
    log(`[${renderingId}] Step 4/5: Video assembled`);

    // ── Step 5: Finalize (90% → 100%) ───────────────────────────────────────
    log(`[${renderingId}] Step 5/5: Finalizing...`);
    await new Promise((r) => setTimeout(r, 500));

    await updateRendering(renderingId, 'COMPLETED', 100, {
      videoKey,
      videoUrl,
      duration,
      fileSize,
      completedAt: new Date(),
    });

    await updateProjectStatus(projectId, 'COMPLETED');
    await job.updateProgress(100);

    log(`[${renderingId}] ✅ Render complete! Video: ${videoUrl}`);
    return { success: true, videoUrl, duration };
  } catch (error: any) {
    log(`[${renderingId}] ❌ Render failed: ${error.message}`);

    await updateRendering(renderingId, 'FAILED', 0, {
      errorMessage: error.message,
      completedAt: new Date(),
    }).catch(() => {});

    await updateProjectStatus(projectId, 'FAILED').catch(() => {});

    throw error;
  }
}

// ─── Start Worker ─────────────────────────────────────────────────────────────
async function startWorker() {
  log('Starting render worker...');
  log(`Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  log(`Storage: ${STORAGE_PATH}`);

  const worker = new Worker(RENDER_QUEUE, processRenderJob, {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  });

  worker.on('active', (job) => {
    log(`Job ${job.id} started`);
  });

  worker.on('completed', (job, result) => {
    log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    log(`Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    log(`Worker error: ${err.message}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log('Shutting down worker...');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log('Shutting down worker...');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  log('✅ Render worker is running and waiting for jobs...');
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
