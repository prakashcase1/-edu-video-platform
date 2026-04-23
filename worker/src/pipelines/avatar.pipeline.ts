import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import axios from 'axios';
import { execSync } from 'child_process';
import { FfmpegService } from '../services/ffmpeg.service';
import { TtsService } from '../services/tts.service';
import { StorageService } from '../services/storage.service';

type ProgressCallback = (progress: number) => Promise<void>;

export class AvatarPipeline {
  private ffmpeg: FfmpegService;
  private readonly didApiKey: string;
  private readonly ffmpegPath: string;

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private ttsService: TtsService,
  ) {
    this.ffmpeg = new FfmpegService();
    this.didApiKey = process.env.DID_API_KEY;
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  }

  async execute(
    project: any,
    workDir: string,
    onProgress: ProgressCallback,
  ): Promise<{ videoPath: string; duration: number }> {
    console.log(`[AvatarPipeline] Starting for project ${project.id}`);

    const scenes = project.scenes;
    const slides = project.slides;
    const voiceConfig = project.voiceConfig;
    const avatarConfig = project.avatar;

    // Step 1: Download slides (5-10%)
    await onProgress(5);
    const slideDir = path.join(workDir, 'slides');
    fs.mkdirSync(slideDir, { recursive: true });
    const localSlides = await this.downloadSlides(slides, slideDir);

    // Step 2: Generate audio per scene (10-50%)
    const audioDir = path.join(workDir, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    const sceneData: {
      scene: any;
      audioPath: string;
      audioDuration: number;
      audioUrl: string;
    }[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const audioPath = path.join(audioDir, `scene_${i}.mp3`);

      await this.ttsService.generateSpeech(
        scene.scriptText,
        {
          voiceId: voiceConfig?.voiceId,
          speed: voiceConfig?.speed || 1.0,
          language: voiceConfig?.language || 'en',
        },
        audioPath,
      );

      const audioKey = `projects/${project.id}/audio/scene_${scene.id}.mp3`;
      const audioUrl = await this.storageService.uploadFromPath(audioKey, audioPath, 'audio/mpeg');
      await this.prisma.scene.update({
        where: { id: scene.id },
        data: { audioKey, audioUrl },
      });

      const audioDuration = await this.ffmpeg.getAudioDuration(audioPath);
      sceneData.push({ scene, audioPath, audioDuration, audioUrl });

      const progressPct = 10 + Math.floor((i / scenes.length) * 40);
      await onProgress(progressPct);
      console.log(`[AvatarPipeline] Audio ${i + 1}/${scenes.length} (${audioDuration.toFixed(1)}s)`);
    }

    // Step 3: Generate avatar video clips per scene (50-80%)
    await onProgress(50);
    const avatarDir = path.join(workDir, 'avatar');
    fs.mkdirSync(avatarDir, { recursive: true });

    const sceneClips: string[] = [];

    for (let i = 0; i < sceneData.length; i++) {
      const { scene, audioPath, audioDuration, audioUrl } = sceneData[i];
      const avatarClipPath = path.join(avatarDir, `avatar_clip_${i}.mp4`);
      const finalClipPath = path.join(avatarDir, `final_clip_${i}.mp4`);

      // FIX Bug 1 & 2: resolve the real avatar face image URL from avatarConfig.
      // previewUrl is saved by StepAvatar.tsx → projectsApi.setAvatarConfig() and
      // stored in the DB avatar row. Always falls back to the known Unsplash map.
      const avatarImageUrl = this.resolveAvatarImageUrl(
        avatarConfig?.avatarId,
        avatarConfig?.previewUrl,
      );

      // Generate avatar video
      if (this.didApiKey) {
        await this.generateDIdClip(
          avatarConfig?.avatarId,
          avatarImageUrl,
          scene.scriptText,
          avatarClipPath,
          audioDuration,
        );
      } else {
        await this.generateMockAvatarClip(
          avatarConfig?.avatarId || 'avatar_alex',
          avatarImageUrl,   // ← FIX: passed so mock can render the real face
          audioPath,
          avatarClipPath,
          audioDuration,
        );
      }

      // Overlay avatar on slide if slides exist
      const sceneSlides = slides.filter((s: any) => s.sceneId === scene.id);
      const slideData = sceneSlides.length > 0
        ? localSlides.find((ls) => ls.id === sceneSlides[0].id)
        : localSlides[i % Math.max(1, localSlides.length)];

      if (slideData?.localPath) {
        // FIX Bug 3: Use single-pass imageToVideoWithAvatar() instead of the
        // deprecated two-pass imageToVideo() + overlayAvatarOnSlide() approach.
        // This halves per-scene encoding time and keeps audio sync intact.
        await this.ffmpeg.imageToVideoWithAvatar(
          slideData.localPath,
          audioPath,
          avatarClipPath,
          finalClipPath,
          audioDuration,
        );
        sceneClips.push(finalClipPath);
      } else {
        sceneClips.push(avatarClipPath);
      }

      const progressPct = 50 + Math.floor((i / sceneData.length) * 30);
      await onProgress(progressPct);
      console.log(`[AvatarPipeline] Scene clip ${i + 1}/${sceneData.length} done`);
    }

    // Step 4: Concatenate all clips (80-95%)
    await onProgress(80);
    const rawOutputPath = path.join(workDir, 'output_raw.mp4');

    if (sceneClips.length === 1) {
      fs.copyFileSync(sceneClips[0], rawOutputPath);
    } else {
      await this.ffmpeg.concatenateVideos(sceneClips, rawOutputPath);
    }

    // Step 5: Finalize with fades (95-99%)
    await onProgress(95);
    const finalOutputPath = path.join(workDir, 'final_output.mp4');
    const totalDuration = await this.ffmpeg.getVideoDuration(rawOutputPath);

    if (totalDuration > 2) {
      await this.ffmpeg.addFadeEffects(rawOutputPath, finalOutputPath, totalDuration);
    } else {
      fs.copyFileSync(rawOutputPath, finalOutputPath);
    }

    const finalDuration = await this.ffmpeg.getVideoDuration(finalOutputPath);
    console.log(`[AvatarPipeline] Complete. Duration: ${finalDuration.toFixed(1)}s`);

    await onProgress(99);
    return { videoPath: finalOutputPath, duration: finalDuration };
  }

  private async generateDIdClip(
    avatarId: string,
    imageUrl: string,
    scriptText: string,
    outputPath: string,
    duration: number,
  ): Promise<void> {
    try {
      const authHeader = `Basic ${Buffer.from(`${this.didApiKey}:`).toString('base64')}`;

      // FIX: D-ID requires source_url to end with .jpg/.png.
      // Unsplash URLs have query params so they fail D-ID's validation.
      // Solution: download the image locally, upload it to D-ID's /images
      // endpoint, and use the returned hosted URL as source_url.
      const tempImgPath = outputPath.replace(/\.mp4$/, '_did_src.jpg');
      await this.downloadFile(imageUrl, tempImgPath);

      const FormData = require('form-data');
      const form = new FormData();
      form.append('image', fs.createReadStream(tempImgPath), {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      });

      const uploadRes = await axios.post('https://api.d-id.com/images', form, {
        headers: { ...form.getHeaders(), Authorization: authHeader },
        timeout: 30000,
      });
      const hostedImageUrl: string = uploadRes.data.url;
      try { fs.unlinkSync(tempImgPath); } catch {}

      console.log(`[AvatarPipeline] D-ID image uploaded: ${hostedImageUrl}`);

      const createRes = await axios.post(
        'https://api.d-id.com/talks',
        {
          source_url: hostedImageUrl,
          script: {
            type:     'text',
            input:    scriptText,
            provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' },
          },
          config: { fluent: true, pad_audio: 0.5 },
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const talkId = createRes.data.id;
      console.log(`[AvatarPipeline] D-ID talk created: ${talkId}`);

      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
          headers: { Authorization: authHeader },
        });

        const status = statusRes.data.status;
        console.log(`[AvatarPipeline] D-ID status (attempt ${attempt + 1}): ${status}`);

        if (status === 'done') {
          const videoBuffer = await axios.get(statusRes.data.result_url, {
            responseType: 'arraybuffer',
            timeout: 60000,
          });
          fs.writeFileSync(outputPath, Buffer.from(videoBuffer.data));
          console.log(`[AvatarPipeline] D-ID clip saved: ${path.basename(outputPath)}`);
          return;
        }

        if (status === 'error') {
          throw new Error(`D-ID processing failed: ${JSON.stringify(statusRes.data.error || '')}`);
        }
      }

      throw new Error('D-ID timeout after 120s');
    } catch (err: any) {
      const didError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.warn(`[AvatarPipeline] D-ID failed: ${didError}. Falling back to mock.`);
      await this.generateMockAvatarClip(avatarId, imageUrl, null, outputPath, duration);
    }
  }

  private async generateMockAvatarClip(
    avatarId: string,
    imageUrl: string | null,
    audioPath: string | null,
    outputPath: string,
    duration: number,
  ): Promise<void> {
    const safeOutputPath = outputPath.replace(/\\/g, '/');

    // Try to download the real face photo and use it as still image
    let avatarImagePath: string | null = null;
    if (imageUrl) {
      try {
        const imgPath = outputPath.replace(/\.mp4$/, '_face.jpg');
        await this.downloadFile(imageUrl, imgPath);
        if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 1000) {
          avatarImagePath = imgPath;
        }
      } catch (err: any) {
        console.warn(`[AvatarPipeline] Face photo download failed: ${err.message}, using color fallback`);
      }
    }

    try {
      if (avatarImagePath) {
        // ✅ Use real face photo as still image avatar
        const safeImgPath = avatarImagePath.replace(/\\/g, '/');
        if (audioPath && fs.existsSync(audioPath)) {
          const safeAudioPath = audioPath.replace(/\\/g, '/');
          execSync(
            `${this.ffmpegPath} -loop 1 -i "${safeImgPath}" -i "${safeAudioPath}" ` +
              `-c:v libx264 -preset veryfast -tune stillimage -c:a aac ` +
              `-vf "scale=320:320:force_original_aspect_ratio=increase,crop=320:320" ` +
              `-shortest -pix_fmt yuv420p -y "${safeOutputPath}"`,
            { stdio: 'pipe' },
          );
        } else {
          execSync(
            `${this.ffmpegPath} -loop 1 -i "${safeImgPath}" ` +
              `-c:v libx264 -preset veryfast -tune stillimage ` +
              `-vf "scale=320:320:force_original_aspect_ratio=increase,crop=320:320" ` +
              `-t ${duration} -pix_fmt yuv420p -y "${safeOutputPath}"`,
            { stdio: 'pipe' },
          );
        }
        // Cleanup temp face image
        try { fs.unlinkSync(avatarImagePath); } catch {}
      } else {
        // Fallback: solid color block
        const color = this.getAvatarColor(avatarId);
        if (audioPath && fs.existsSync(audioPath)) {
          const safeAudioPath = audioPath.replace(/\\/g, '/');
          execSync(
            `${this.ffmpegPath} -f lavfi -i "color=c=${color}:size=320x320:rate=25" ` +
              `-i "${safeAudioPath}" ` +
              `-c:v libx264 -preset veryfast -c:a aac -shortest -pix_fmt yuv420p -y "${safeOutputPath}"`,
            { stdio: 'pipe' },
          );
        } else {
          execSync(
            `${this.ffmpegPath} -f lavfi -i "color=c=${color}:size=320x320:rate=25" ` +
              `-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" ` +
              `-c:v libx264 -preset veryfast -c:a aac -t ${duration} -pix_fmt yuv420p -y "${safeOutputPath}"`,
            { stdio: 'pipe' },
          );
        }
      }
      console.log(`[AvatarPipeline] Avatar clip generated: ${path.basename(outputPath)} (photo=${!!avatarImagePath})`);
    } catch (err: any) {
      console.error('[AvatarPipeline] Avatar clip generation failed:', err.message);
      throw err;
    }
  }

  /** Download a remote URL to a local file path.
   *  FIX: replaced raw https.get (which does NOT follow redirects) with axios.
   *  Unsplash image URLs return HTTP 302 → the old implementation wrote an
   *  empty file → generateMockAvatarClip fell back to a colour swatch →
   *  no face visible in the rendered video.
   *  axios follows redirects automatically (up to maxRedirects: 5).
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'EduVideo/1.0' },
      maxRedirects: 5,
      timeout: 15000,
    });
    fs.writeFileSync(destPath, Buffer.from(response.data));
  }

  private async downloadSlides(slides: any[], slideDir: string): Promise<{ id: string; localPath: string }[]> {
    const downloaded: { id: string; localPath: string }[] = [];
    for (const slide of slides) {
      const ext = path.extname(slide.filename) || '.png';
      const localPath = path.join(slideDir, `${slide.id}${ext}`);
      try {
        await this.storageService.downloadToPath(slide.storageKey, localPath);
        downloaded.push({ id: slide.id, localPath });
      } catch (err) {
        console.warn(`[AvatarPipeline] Slide download failed: ${err.message}`);
      }
    }
    return downloaded;
  }

  /**
   * Resolve the real face photo URL for an avatar.
   * Priority: DB-stored previewUrl (set by StepAvatar.tsx) → known Unsplash map → null.
   * This is the single source of truth for the image that D-ID and mock both use.
   */
  private resolveAvatarImageUrl(avatarId?: string, previewUrl?: string): string {
    if (previewUrl) return previewUrl;

    // Fallback: same Unsplash URLs used in StepAvatar.tsx AVATAR_IMAGE_URLS
    const AVATAR_IMAGE_URLS: Record<string, string> = {
      avatar_alex:     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=533&fit=crop&crop=face',
      avatar_sophia:   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=533&fit=crop&crop=face',
      avatar_marcus:   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=533&fit=crop&crop=face',
      avatar_isabella: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=533&fit=crop&crop=face',
      avatar_chen:     'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=533&fit=crop&crop=face',
      avatar_amara:    'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=533&fit=crop&crop=face',
    };
    return AVATAR_IMAGE_URLS[avatarId || ''] || AVATAR_IMAGE_URLS['avatar_alex'];
  }

  private getAvatarColor(avatarId: string): string {
    const colors: Record<string, string> = {
      avatar_alex:     '0x2C3E50',
      avatar_sophia:   '0xE91E8C',
      avatar_marcus:   '0x1ABC9C',
      avatar_isabella: '0x9B59B6',
      avatar_chen:     '0x3498DB',
      avatar_amara:    '0xE67E22',
    };
    return colors[avatarId] || '0x4A90D9';
  }
}