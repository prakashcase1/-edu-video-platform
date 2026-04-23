import ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';
import * as path from 'path';

export interface SlideAudioPair {
  slidePath: string;
  audioPath: string;
  duration: number;
}

export class FfmpegService {
  private ffmpegPath: string;

  constructor() {
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    ffmpeg.setFfmpegPath(this.ffmpegPath);
  }

  getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Convert a still image + audio into a video clip.
   *
   * FIX 1: Added `onProgress` callback so callers get live updates instead of
   *         a frozen progress bar for the entire duration of the encode.
   * FIX 2: Added `-preset veryfast` — the default (medium) is 5-8× slower with
   *         negligible quality difference for educational slide video.
   * Throttled internally to once per 1.5 s.
   */
  imageToVideo(
    imagePath: string,
    audioPath: string,
    outputPath: string,
    duration: number,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let lastEmit = 0;

      const cmd = ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1'])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-preset veryfast',        // FIX: was missing → default "medium" = 5-8× slower
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          `-t ${duration + 0.5}`,
          '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-r 25',
          '-movflags +faststart',
        ])
        .output(outputPath);

      if (onProgress && duration > 0) {
        cmd.on('progress', (progress) => {
          const now = Date.now();
          if (now - lastEmit < 1500) return;
          lastEmit = now;
          try {
            const parts = (progress.timemark || '').split(':');
            if (parts.length === 3) {
              const seconds =
                parseFloat(parts[0]) * 3600 +
                parseFloat(parts[1]) * 60 +
                parseFloat(parts[2]);
              const pct = Math.min(99, Math.floor((seconds / duration) * 100));
              onProgress(pct);
            }
          } catch {
            // ignore malformed timemark
          }
        });
      }

      cmd
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`imageToVideo failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Slide image + audio → video with avatar overlaid — all in ONE ffmpeg pass.
   *
   * FIX: Previously avatar pipeline ran imageToVideo() then overlayAvatarOnSlide()
   *      sequentially = 2 full re-encodes per scene. This merges them into one,
   *      cutting per-scene encoding time roughly in half.
   *
   * onProgress: throttled to once per 1.5 s.
   */
  imageToVideoWithAvatar(
    imagePath: string,
    audioPath: string,
    avatarVideoPath: string,
    outputPath: string,
    duration: number,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let lastEmit = 0;

      const cmd = ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1'])
        .input(audioPath)
        .input(avatarVideoPath)
        .complexFilter([
          // Scale slide to 1920×1080 with letterbox padding
          '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,' +
            'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[bg]',
          // Scale avatar to 320×320
          '[2:v]scale=320:320[avatar]',
          // Overlay avatar bottom-right
          '[bg][avatar]overlay=W-w-20:H-h-20[v]',
        ])
        .outputOptions([
          '-map [v]',
          '-map 1:a',
          '-c:v libx264',
          '-preset veryfast',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          `-t ${duration + 0.5}`,
          '-r 25',
          '-movflags +faststart',
        ])
        .output(outputPath);

      if (onProgress && duration > 0) {
        cmd.on('progress', (progress) => {
          const now = Date.now();
          if (now - lastEmit < 1500) return;
          lastEmit = now;
          try {
            const parts = (progress.timemark || '').split(':');
            if (parts.length === 3) {
              const seconds =
                parseFloat(parts[0]) * 3600 +
                parseFloat(parts[1]) * 60 +
                parseFloat(parts[2]);
              const pct = Math.min(99, Math.floor((seconds / duration) * 100));
              onProgress(pct);
            }
          } catch {}
        });
      }

      cmd
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`imageToVideoWithAvatar failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Concatenate multiple video files into one.
   *
   * FIX: Added `-preset veryfast` to match the encoding speed of other methods.
   * onProgress throttled to once per 1.5 s.
   */
  concatenateVideos(
    videoPaths: string[],
    outputPath: string,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const listFile = outputPath.replace('.mp4', '_list.txt');
      const fileList = videoPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(listFile, fileList);

      let lastEmit = 0;

      const cmd = ffmpeg()
        .input(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:v libx264',
          '-preset veryfast',        // FIX: was missing
          '-c:a aac',
          '-b:a 192k',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
        ])
        .output(outputPath);

      if (onProgress) {
        cmd.on('progress', (progress) => {
          const now = Date.now();
          if (now - lastEmit < 1500) return;
          lastEmit = now;
          const pct = Math.min(99, Math.max(0, Math.round(progress.percent || 0)));
          onProgress(pct);
        });
      }

      cmd
        .on('end', () => {
          try { fs.unlinkSync(listFile); } catch {}
          resolve(outputPath);
        })
        .on('error', (err) => {
          try { fs.unlinkSync(listFile); } catch {}
          reject(new Error(`concatenateVideos failed: ${err.message}`));
        })
        .run();
    });
  }

  addAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`addAudioToVideo failed: ${err.message}`)))
        .run();
    });
  }

  normalizeImage(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .outputOptions([
          '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
          '-frames:v 1',
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`normalizeImage failed: ${err.message}`)))
        .run();
    });
  }

  generateSilence(outputPath: string, durationSeconds: number): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(`anullsrc=channel_layout=stereo:sample_rate=44100`)
        .inputFormat('lavfi')
        .outputOptions([`-t ${durationSeconds}`, '-c:a aac', '-b:a 128k'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`generateSilence failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Add intro/outro fade effects.
   * FIX: Added `-preset veryfast` to match other encoding steps.
   * onProgress throttled to once per 1.5 s.
   */
  addFadeEffects(
    inputPath: string,
    outputPath: string,
    duration: number,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fadeIn = 0.5;
      const fadeOut = Math.max(0, duration - 0.5);

      let lastEmit = 0;

      const cmd = ffmpeg()
        .input(inputPath)
        .outputOptions([
          `-vf fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${fadeOut}:d=${fadeIn}`,
          `-af afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOut}:d=${fadeIn}`,
          '-c:v libx264',
          '-preset veryfast',
          '-c:a aac',
          '-movflags +faststart',
        ])
        .output(outputPath);

      if (onProgress && duration > 0) {
        cmd.on('progress', (progress) => {
          const now = Date.now();
          if (now - lastEmit < 1500) return;
          lastEmit = now;
          try {
            const parts = (progress.timemark || '').split(':');
            if (parts.length === 3) {
              const seconds =
                parseFloat(parts[0]) * 3600 +
                parseFloat(parts[1]) * 60 +
                parseFloat(parts[2]);
              const pct = Math.min(99, Math.floor((seconds / duration) * 100));
              onProgress(pct);
            }
          } catch {}
        });
      }

      // Set a timeout — fluent-ffmpeg can hang silently on Windows
      const timeoutMs = Math.max(120000, duration * 3000);
      const timer = setTimeout(() => {
        try { (cmd as any).kill('SIGKILL'); } catch {}
        // Fall back: copy raw file as final output
        try { require('fs').copyFileSync(inputPath, outputPath); } catch {}
        console.warn('[FfmpegService] addFadeEffects timed out, using raw output');
        resolve(outputPath);
      }, timeoutMs);

      cmd
        .on('end', () => { clearTimeout(timer); resolve(outputPath); })
        .on('error', (err) => {
          clearTimeout(timer);
          // On error, copy input as fallback instead of rejecting
          try { require('fs').copyFileSync(inputPath, outputPath); } catch {}
          console.warn(`[FfmpegService] addFadeEffects failed (${err.message}), using raw output`);
          resolve(outputPath);
        })
        .run();
    });
  }

  /**
   * @deprecated Use imageToVideoWithAvatar() for a single-pass encode instead.
   * Kept for backwards compatibility.
   */
  overlayAvatarOnSlide(
    slideVideoPath: string,
    avatarVideoPath: string,
    outputPath: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(slideVideoPath)
        .input(avatarVideoPath)
        .complexFilter([
          '[1:v]scale=320:320[avatar]',
          '[0:v][avatar]overlay=W-w-20:H-h-20[v]',
        ])
        .outputOptions([
          '-map [v]',
          '-map 0:a',
          '-c:v libx264',
          '-preset veryfast',
          '-c:a aac',
          '-shortest',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`overlayAvatarOnSlide failed: ${err.message}`)))
        .run();
    });
  }

  convertToPng(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .outputOptions(['-frames:v 1'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`convertToPng failed: ${err.message}`)))
        .run();
    });
  }

  probe(filePath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }
}