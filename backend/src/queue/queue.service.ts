import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export const RENDER_QUEUE = 'render-queue';
export const AUDIO_QUEUE = 'audio-queue';

export interface RenderJobData {
  projectId: string;
  renderingId: string;
  userId: string;
  mode: 'NO_FACE' | 'AVATAR';
}

export interface AudioJobData {
  projectId: string;
  sceneId: string;
  scriptText: string;
  voiceConfig: {
    voiceId: string;
    speed: number;
    pitch: number;
    language: string;
  };
  outputKey: string;
}

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private renderQueue: Queue;
  private audioQueue: Queue;
  private connection: IORedis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.connection = new IORedis({
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
      maxRetriesPerRequest: null,
    });

    const connectionOptions = { connection: this.connection };

    this.renderQueue = new Queue(RENDER_QUEUE, {
      ...connectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.audioQueue = new Queue(AUDIO_QUEUE, {
      ...connectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });

    this.logger.log('Queue service initialized');
  }

  async addRenderJob(data: RenderJobData): Promise<Job> {
    const job = await this.renderQueue.add('render-video', data, {
      jobId: data.renderingId,
      priority: 1,
    });
    this.logger.log(`Render job queued: ${job.id} for project ${data.projectId}`);
    return job;
  }

  async addAudioJob(data: AudioJobData): Promise<Job> {
    const job = await this.audioQueue.add('generate-audio', data);
    this.logger.log(`Audio job queued: ${job.id} for scene ${data.sceneId}`);
    return job;
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = queueName === RENDER_QUEUE ? this.renderQueue : this.audioQueue;
    const job = await queue.getJob(jobId);

    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  async getRenderQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.renderQueue.getWaitingCount(),
      this.renderQueue.getActiveCount(),
      this.renderQueue.getCompletedCount(),
      this.renderQueue.getFailedCount(),
      this.renderQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  getRenderQueue(): Queue {
    return this.renderQueue;
  }

  getAudioQueue(): Queue {
    return this.audioQueue;
  }

  getConnection(): IORedis {
    return this.connection;
  }
}
