import * as dotenv from 'dotenv';
dotenv.config();

import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { RenderProcessor } from './processors/render.processor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const renderProcessor = new RenderProcessor(prisma);

// ─── FIX: Added job-level timeout ────────────────────────────────────────────
// Previously there was NO timeout, so a hung ffmpeg process or a stalled D-ID
// poll would block a worker slot indefinitely. With concurrency=2 this would
// eventually freeze ALL rendering for all users.
//
// Default: 45 minutes. A typical 20-scene video completes in < 15 min.
// Override via env: RENDER_JOB_TIMEOUT_MS=3600000 (1 hour for very long projects)
//
// BullMQ will mark the job FAILED and release the worker slot when the
// timeout fires, so other jobs in the queue are not blocked.
// ─────────────────────────────────────────────────────────────────────────────
const JOB_TIMEOUT_MS = parseInt(process.env.RENDER_JOB_TIMEOUT_MS || String(45 * 60 * 1000));

// ─── FIX: Added stallInterval + maxStalledCount ──────────────────────────────
// A "stalled" job is one whose worker process died (OOM, SIGKILL, etc.) without
// completing or failing. Without this, stalled jobs sit in the active queue
// forever and block slots. BullMQ detects stalls by checking the worker's
// heartbeat every `stalledInterval` ms; after `maxStalledCount` missed beats
// the job is re-queued or failed.
// ─────────────────────────────────────────────────────────────────────────────
const renderWorker = new Worker(
  'render-queue',
  async (job) => {
    console.log(`[Worker] Processing render job ${job.id}:`, job.data);
    return renderProcessor.process(job);
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    limiter: {
      max: 10,
      duration: 60_000,
    },
    // FIX: job-level timeout — kills the job if it runs longer than this
    lockDuration: JOB_TIMEOUT_MS,
    // FIX: stall detection — check heartbeat every 30s
    stalledInterval: 30_000,
    maxStalledCount: 2,       // re-queue up to 2 times before marking as failed
  },
);

renderWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

renderWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

renderWorker.on('progress', (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
});

renderWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// FIX: Log stalled jobs so they are visible in logs/alerting
renderWorker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled — worker may have crashed`);
});

const queueEvents = new QueueEvents('render-queue', { connection });

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`[Queue] Job ${jobId} waiting`);
});

queueEvents.on('active', ({ jobId }) => {
  console.log(`[Queue] Job ${jobId} active`);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  await renderWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  await renderWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Worker] Educational Video Worker started');
console.log(`[Worker] Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`[Worker] Concurrency: ${process.env.WORKER_CONCURRENCY || 2}`);
console.log(`[Worker] Job timeout: ${JOB_TIMEOUT_MS / 1000}s`);
