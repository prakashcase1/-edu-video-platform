import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { FfmpegService } from '../services/ffmpeg.service';
import { TtsService } from '../services/tts.service';
import { StorageService } from '../services/storage.service';

type ProgressCallback = (progress: number) => Promise<void>;

/**
 * Run an array of async tasks with at most `limit` running at the same time.
 * Preserves result order.
 */
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class NoFacePipeline {
  private ffmpeg: FfmpegService;
  private readonly ffmpegPath: string;

  private readonly AUDIO_CONCURRENCY = parseInt(process.env.AUDIO_CONCURRENCY || '4');
  private readonly CLIP_CONCURRENCY  = parseInt(process.env.CLIP_CONCURRENCY  || '3');

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private ttsService: TtsService,
  ) {
    this.ffmpeg = new FfmpegService();
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  }

  async execute(
    project: any,
    workDir: string,
    onProgress: ProgressCallback,
  ): Promise<{ videoPath: string; duration: number }> {
    console.log(`[NoFacePipeline] Starting for project ${project.id}`);

    const scenes = project.scenes;
    const slides = project.slides;
    const voiceConfig = project.voiceConfig;

    // ─── Step 1: Download all slides in parallel (0-10%) ─────────────────────
    await onProgress(5);
    const slideDir = path.join(workDir, 'slides');
    fs.mkdirSync(slideDir, { recursive: true });

    const localSlides = await this.downloadSlides(slides, slideDir);
    await onProgress(10);

    // ─── Step 2: Generate audio for each scene in parallel (10-55%) ──────────
    const audioDir = path.join(workDir, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    let audiosDone = 0;
    const audioTasks = scenes.map((scene: any, i: number) => async () => {
      const audioPath = path.join(audioDir, `scene_${i}.mp3`);

      await this.ttsService.generateSpeech(
        scene.scriptText,
        {
          voiceId: voiceConfig?.voiceId,
          speed: voiceConfig?.speed || 1.0,
          pitch: voiceConfig?.pitch || 1.0,
          language: voiceConfig?.language || 'en',
        },
        audioPath,
      );

      const audioKey = `projects/${project.id}/audio/scene_${scene.id}.mp3`;
      await this.storageService.uploadFromPath(audioKey, audioPath, 'audio/mpeg');
      await this.prisma.scene.update({
        where: { id: scene.id },
        data: { audioKey, audioUrl: this.storageService.getPublicUrl(audioKey) },
      });

      const duration = await this.ffmpeg.getAudioDuration(audioPath);

      audiosDone++;
      const pct = 10 + Math.floor((audiosDone / scenes.length) * 45);
      await onProgress(pct);
      console.log(`[NoFacePipeline] Audio ${audiosDone}/${scenes.length} done (${duration.toFixed(1)}s)`);

      return { sceneId: scene.id, audioPath, duration };
    });

    const sceneAudios = await pLimit(audioTasks, this.AUDIO_CONCURRENCY);

    // ─── Step 3: Build scene clips in parallel (55-82%) ───────────────────────
    await onProgress(55);
    const clipsDir = path.join(workDir, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });

    let clipsDone = 0;

    const clipTasks = scenes.map((scene: any, i: number) => async () => {
      const sceneAudio = sceneAudios[i];

      const sceneSlides = slides.filter((s: any) => s.sceneId === scene.id);
      const slideToUse = sceneSlides.length > 0
        ? sceneSlides[0]
        : localSlides[i % Math.max(1, localSlides.length)];

      let slidePath: string;
      if (slideToUse && typeof slideToUse === 'string') {
        slidePath = slideToUse;
      } else if (slideToUse?.localPath) {
        slidePath = slideToUse.localPath;
      } else {
        slidePath = await this.createBlankSlide(workDir, i);
      }

      const clipPath = path.join(clipsDir, `clip_${i}.mp4`);

      const clipStart = 55 + Math.floor((i / scenes.length) * 27);
      const clipEnd   = 55 + Math.floor(((i + 1) / scenes.length) * 27);

      await this.ffmpeg.imageToVideo(
        slidePath,
        sceneAudio.audioPath,
        clipPath,
        sceneAudio.duration,
        (pct) => {
          const mapped = clipStart + Math.floor((pct / 100) * (clipEnd - clipStart));
          onProgress(mapped).catch(() => {});
        },
      );

      clipsDone++;
      console.log(`[NoFacePipeline] Clip ${clipsDone}/${scenes.length} done`);
      return clipPath;
    });

    const sceneClips = await pLimit(clipTasks, this.CLIP_CONCURRENCY);

    // ─── Step 4: Concatenate (82-92%) ─────────────────────────────────────────
    await onProgress(82);
    const rawOutputPath = path.join(workDir, 'output_raw.mp4');

    if (sceneClips.length === 1) {
      fs.copyFileSync(sceneClips[0], rawOutputPath);
      await onProgress(92);
    } else {
      await this.ffmpeg.concatenateVideos(
        sceneClips,
        rawOutputPath,
        (pct) => {
          const mapped = 82 + Math.floor(pct * 0.10);
          onProgress(mapped).catch(() => {});
        },
      );
      await onProgress(92);
    }

    console.log(`[NoFacePipeline] Concatenation complete`);

    // ─── Step 5: Fade effects (92-99%) ────────────────────────────────────────
    const finalOutputPath = path.join(workDir, 'final_output.mp4');
    const totalDuration = await this.ffmpeg.getVideoDuration(rawOutputPath);

    if (totalDuration > 2) {
      await this.ffmpeg.addFadeEffects(
        rawOutputPath,
        finalOutputPath,
        totalDuration,
        (pct) => {
          const mapped = 92 + Math.floor(pct * 0.07);
          onProgress(mapped).catch(() => {});
        },
      );
    } else {
      fs.copyFileSync(rawOutputPath, finalOutputPath);
    }

    const finalDuration = await this.ffmpeg.getVideoDuration(finalOutputPath);
    console.log(`[NoFacePipeline] Complete. Duration: ${finalDuration.toFixed(1)}s`);

    await onProgress(99);
    return { videoPath: finalOutputPath, duration: finalDuration };
  }

  private async downloadSlides(
    slides: any[],
    slideDir: string,
  ): Promise<{ id: string; localPath: string }[]> {
    return Promise.all(
      slides.map(async (slide) => {
        const ext = path.extname(slide.filename) || '.png';
        const localPath = path.join(slideDir, `${slide.id}${ext}`);
        try {
          await this.storageService.downloadToPath(slide.storageKey, localPath);
          return { id: slide.id, localPath };
        } catch (err) {
          console.warn(`[NoFacePipeline] Could not download slide ${slide.id}: ${(err as Error).message}`);
          const fallbackPath = await this.createBlankSlide(slideDir, slides.indexOf(slide));
          return { id: slide.id, localPath: fallbackPath };
        }
      }),
    );
  }

  private async createBlankSlide(workDir: string, index: number): Promise<string> {
    const outputPath = path.join(workDir, `blank_slide_${index}.png`);

    // ✅ Fix: No drawtext/fontfile at all — avoids Windows font path crashes
    // Simple dark background, clean and reliable on all platforms
    const safeOutputPath = outputPath.replace(/\\/g, '/');

    try {
      execSync(
        `${this.ffmpegPath} -f lavfi -i color=c=0x1a1a2e:size=1920x1080:rate=1 -frames:v 1 -y "${safeOutputPath}"`,
        { stdio: 'pipe' },
      );
    } catch {
      // Absolute fallback — plain black
      execSync(
        `${this.ffmpegPath} -f lavfi -i color=c=black:size=1920x1080:rate=1 -frames:v 1 -y "${safeOutputPath}"`,
        { stdio: 'pipe' },
      );
    }

    return outputPath;
  }
}