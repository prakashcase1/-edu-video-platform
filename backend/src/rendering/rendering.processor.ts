import * as dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_PATH    = process.env.LOCAL_STORAGE_PATH || './uploads';
const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL || 'http://localhost:3000';
const FFMPEG          = process.env.FFMPEG_PATH || 'ffmpeg';
const TEMP_DIR        = process.env.FFMPEG_TEMP_DIR || 'C:/tmp/edu-video';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RenderJobData {
  projectId:   string;
  renderingId: string;
  userId:      string;
  mode:        'NO_FACE' | 'AVATAR';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg: string) { console.log(`[RenderProcessor] ${msg}`); }

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function toFfmpegPath(p: string): string { return p.replace(/\\/g, '/'); }

function execCmd(cmd: string): void {
  const { execSync } = require('child_process');
  execSync(cmd, { stdio: 'pipe' });
}

// ─── Avatar SVG Definitions ───────────────────────────────────────────────────
// FIX: The original assembleAvatarVideo() drew a plain colored rectangle with
//      no avatar at all, causing the blank/robot placeholder seen in Image 2.
//      Fix: define SVG cartoon avatars matching the 6 characters in Image 1
//      (Alex, Jordan, Sam, Riley, Morgan, Taylor), rasterise to PNG with sharp,
//      and overlay on the video frame in the bottom-right corner with FFmpeg.
interface AvatarStyle {
  skinTone:  string;
  hairColor: string;
  hairStyle: 'round' | 'cap';
  bgColor:   string;
}

const AVATAR_STYLES: Record<string, AvatarStyle> = {
  alex:   { skinTone: '#F5CBA7', hairColor: '#6B4226', hairStyle: 'round', bgColor: '#1a1a2e' },
  jordan: { skinTone: '#D4A96A', hairColor: '#7B2D8B', hairStyle: 'cap',   bgColor: '#1a1a2e' },
  sam:    { skinTone: '#8D5524', hairColor: '#2C1A0E', hairStyle: 'round', bgColor: '#1a1a2e' },
  riley:  { skinTone: '#FADADD', hairColor: '#FF6B00', hairStyle: 'round', bgColor: '#1a1a2e' },
  morgan: { skinTone: '#C68642', hairColor: '#5C3317', hairStyle: 'round', bgColor: '#1a1a2e' },
  taylor: { skinTone: '#8D5524', hairColor: '#FF6B00', hairStyle: 'cap',   bgColor: '#1a1a2e' },
};

function adjustBrightness(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function buildAvatarSvg(style: AvatarStyle): string {
  const { skinTone, hairColor, hairStyle, bgColor } = style;

  const hairPath =
    hairStyle === 'round'
      ? `<ellipse cx="100" cy="72" rx="34" ry="28" fill="${hairColor}"/>
         <rect x="66" y="80" width="68" height="20" fill="${hairColor}"/>`
      : `<rect x="62" y="64" width="76" height="24" rx="8" fill="${hairColor}"/>
         <rect x="56" y="84" width="88" height="8" rx="4" fill="${hairColor}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="${bgColor}"/>
  <circle cx="100" cy="100" r="82"  fill="#252540"/>
  ${hairPath}
  <ellipse cx="100" cy="106" rx="33" ry="36" fill="${skinTone}"/>
  <circle cx="89"  cy="100" r="4" fill="#1a1a2e"/>
  <circle cx="111" cy="100" r="4" fill="#1a1a2e"/>
  <ellipse cx="100" cy="110" rx="3" ry="2" fill="${adjustBrightness(skinTone, -30)}"/>
  <path d="M92 118 Q100 124 108 118" stroke="#1a1a2e" stroke-width="2.5"
        fill="none" stroke-linecap="round"/>
</svg>`;
}

async function generateAvatarPng(avatarName: string, outputPng: string): Promise<string | null> {
  const key   = avatarName.toLowerCase().trim();
  const style = AVATAR_STYLES[key];
  if (!style) {
    log(`Unknown avatar "${avatarName}", skipping overlay`);
    return null;
  }

  const svg     = buildAvatarSvg(style);
  const svgPath = outputPng.replace(/\.png$/, '.svg');
  fs.writeFileSync(svgPath, svg);

  try {
    const sharp = require('sharp');
    await sharp(Buffer.from(svg)).resize(200, 200).png().toFile(outputPng);
    log(`✓ Avatar PNG generated: ${path.basename(outputPng)}`);
    return outputPng;
  } catch {
    try {
      execCmd(`${FFMPEG} -i "${toFfmpegPath(svgPath)}" -y "${toFfmpegPath(outputPng)}"`);
      log(`✓ Avatar PNG via FFmpeg: ${path.basename(outputPng)}`);
      return outputPng;
    } catch {
      log(`Avatar PNG generation failed — overlay will be skipped`);
      return null;
    }
  }
}

// ─── Audio Generation ─────────────────────────────────────────────────────────
async function generateAudio(
  text: string,
  voiceId: string,
  language: string,
  outputPath: string,
): Promise<void> {
  if (ELEVENLABS_API_KEY) {
    try {
      const axios = require('axios');
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || '21m00Tcm4TlvDq8ikWAM'}`,
        { text, model_id: 'eleven_monolingual_v1' },
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 15000, // 15 s — prevents silent hang if ElevenLabs is slow
        },
      );
      fs.writeFileSync(outputPath, Buffer.from(response.data));
      log(`✓ ElevenLabs audio: ${path.basename(outputPath)}`);
      return;
    } catch (e: any) {
      log(`ElevenLabs failed: ${e.message}, trying Google TTS...`);
    }
  }

  try {
    const lang        = language || 'en';
    const encodedText = encodeURIComponent(text.substring(0, 200));
    const url         = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

    // FIX: no timeout was set — if Google stalls the Promise never settles,
    //      freezing the job at whichever progress% the scene loop was on (50%).
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google TTS timeout')), 10000);
      const file  = fs.createWriteStream(outputPath);
      https
        .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          res.pipe(file);
          file.on('finish', () => { clearTimeout(timer); file.close(); resolve(); });
        })
        .on('error', (err) => { clearTimeout(timer); reject(err); });
    });
    log(`✓ Google TTS audio: ${path.basename(outputPath)}`);
    return;
  } catch (e: any) {
    log(`Google TTS failed: ${e.message}, generating silence...`);
  }

  const duration = Math.max(3, Math.ceil(text.split(' ').length / 2.5));
  try {
    execCmd(
      `${FFMPEG} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 ` +
        `-t ${duration} -c:a libmp3lame -y "${toFfmpegPath(outputPath)}"`,
    );
  } catch {
    fs.writeFileSync(outputPath, Buffer.alloc(100));
  }
  log(`✓ Silent audio fallback: ${path.basename(outputPath)}`);
}

// ─── NO_FACE video assembly ───────────────────────────────────────────────────
async function assembleNoFaceVideo(
  renderingId: string,
  scenes: any[],
  slides: any[],
  audioDir: string,
  outputPath: string,
): Promise<void> {
  const clipDir = path.join(TEMP_DIR, renderingId, 'clips');
  ensureDir(clipDir);
  const clipPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene     = scenes[i];
    const audioPath = path.join(audioDir, `${scene.id}.mp3`);
    const clipPath  = path.join(clipDir, `clip_${i}.mp4`);
    const slide     = slides[i % Math.max(slides.length, 1)];

    if (slide && fs.existsSync(path.join(STORAGE_PATH, slide.storageKey))) {
      const slideFile = toFfmpegPath(path.join(STORAGE_PATH, slide.storageKey));
      execCmd(
        `${FFMPEG} -loop 1 -i "${slideFile}" -i "${toFfmpegPath(audioPath)}" ` +
          `-c:v libx264 -c:a aac -pix_fmt yuv420p -shortest -y "${toFfmpegPath(clipPath)}"`,
      );
    } else {
      execCmd(
        `${FFMPEG} -f lavfi -i color=c=1a1a2e:size=1280x720:rate=25 ` +
          `-i "${toFfmpegPath(audioPath)}" -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest -y "${toFfmpegPath(clipPath)}"`,
      );
    }
    clipPaths.push(clipPath);
    log(`  ✓ Clip ${i + 1}/${scenes.length} assembled`);
  }

  await concatClips(clipPaths, outputPath, renderingId);
}

// ─── AVATAR video assembly ────────────────────────────────────────────────────
async function assembleAvatarVideo(
  renderingId: string,
  scenes: any[],
  avatarConfig: any,
  audioDir: string,
  outputPath: string,
): Promise<void> {
  const avatarDir = path.join(TEMP_DIR, renderingId, 'avatar');
  ensureDir(avatarDir);

  // Resolve avatar name from DB record — stored as e.g. "Alex", "riley", "MORGAN"
  const avatarName: string =
    (avatarConfig?.name || avatarConfig?.avatarId || 'alex').toLowerCase().trim();

  // Generate PNG once; reuse for every clip in this rendering
  const avatarPng     = path.join(avatarDir, `${avatarName}.png`);
  const avatarPngPath = await generateAvatarPng(avatarName, avatarPng);

  const clipPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene     = scenes[i];
    const audioPath = path.join(audioDir, `${scene.id}.mp3`);
    const clipPath  = path.join(avatarDir, `avatar_clip_${i}.mp4`);
    const audioFile = toFfmpegPath(audioPath);
    const clipFile  = toFfmpegPath(clipPath);

    if (avatarPngPath && fs.existsSync(avatarPngPath)) {
      // Dark-blue slide background + avatar PNG overlaid bottom-right (x=1060, y=500)
      const pngFile = toFfmpegPath(avatarPngPath);
      execCmd(
        `${FFMPEG} ` +
          `-f lavfi -i color=c=0d1b2a:size=1280x720:rate=25 ` +
          `-i "${audioFile}" ` +
          `-i "${pngFile}" ` +
          `-filter_complex "[0:v][2:v]overlay=1060:500" ` +
          `-c:v libx264 -c:a aac -pix_fmt yuv420p -shortest -y "${clipFile}"`,
      );
    } else {
      // Fallback: plain background if avatar PNG failed
      execCmd(
        `${FFMPEG} -f lavfi -i color=c=0d1b2a:size=1280x720:rate=25 ` +
          `-i "${audioFile}" ` +
          `-c:v libx264 -c:a aac -pix_fmt yuv420p -shortest -y "${clipFile}"`,
      );
    }

    clipPaths.push(clipPath);
    log(`  ✓ Avatar clip ${i + 1}/${scenes.length} (avatar=${avatarName})`);
  }

  await concatClips(clipPaths, outputPath, renderingId);
}

// ─── Concat helper ────────────────────────────────────────────────────────────
async function concatClips(
  clipPaths: string[],
  outputPath: string,
  renderingId: string,
): Promise<void> {
  if (clipPaths.length === 1) {
    fs.copyFileSync(clipPaths[0], outputPath);
    return;
  }
  const listFile    = path.join(TEMP_DIR, renderingId, 'concat.txt');
  const listContent = clipPaths.map((p) => `file '${toFfmpegPath(p)}'`).join('\n');
  fs.writeFileSync(listFile, listContent);
  execCmd(
    `${FFMPEG} -f concat -safe 0 -i "${toFfmpegPath(listFile)}" ` +
      `-c copy -y "${toFfmpegPath(outputPath)}"`,
  );
  log(`✓ Clips concatenated → ${path.basename(outputPath)}`);
}

// ─── Exported class ───────────────────────────────────────────────────────────
export class RenderProcessor {
  constructor(private readonly prisma: PrismaClient) {}

  private async updateRendering(
    renderingId: string,
    status: string,
    progress: number,
    extra: Record<string, any> = {},
  ) {
    await this.prisma.rendering.update({
      where: { id: renderingId },
      data:  { status: status as any, progress, ...extra },
    });
  }

  private async updateProject(projectId: string, status: string) {
    await this.prisma.project.update({
      where: { id: projectId },
      data:  { status: status as any },
    });
  }

  async process(job: Job<RenderJobData>): Promise<void> {
    const { projectId, renderingId, mode } = job.data;
    log(`► START | renderingId=${renderingId} | mode=${mode}`);

    try {
      await this.updateRendering(renderingId, 'PROCESSING', 5, { startedAt: new Date() });
      await this.updateProject(projectId, 'PROCESSING');
      await job.updateProgress(5);

      const project = await this.prisma.project.findUnique({
        where:   { id: projectId },
        include: {
          scenes:      { orderBy: { order: 'asc' } },
          slides:      { orderBy: { order: 'asc' } },
          voiceConfig: true,
          avatar:      true,
        },
      });

      if (!project) throw new Error('Project not found');
      if (!project.scenes.length) throw new Error('No scenes to render');

      await this.updateRendering(renderingId, 'PROCESSING', 10);
      await job.updateProgress(10);
      log(`✓ Loaded project: ${project.scenes.length} scenes, ${project.slides.length} slides`);

      const workDir  = path.join(TEMP_DIR, renderingId);
      const audioDir = path.join(workDir, 'audio');
      ensureDir(audioDir);

      const voiceId    = project.voiceConfig?.voiceId || '21m00Tcm4TlvDq8ikWAM';
      const language   = project.voiceConfig?.language || 'en';
      const sceneCount = project.scenes.length;

      for (let i = 0; i < sceneCount; i++) {
        const scene     = project.scenes[i];
        const audioPath = path.join(audioDir, `${scene.id}.mp3`);
        const progress  = 10 + Math.round((i / sceneCount) * 50);
        log(`  Generating audio ${i + 1}/${sceneCount}...`);
        await generateAudio(scene.scriptText || `Scene ${i + 1}`, voiceId, language, audioPath);
        const audioDuration = Math.max(2, Math.ceil((scene.scriptText?.split(' ').length ?? 5) / 2.5));
        await this.prisma.scene.update({
          where: { id: scene.id },
          data:  { audioKey: `audio/${scene.id}.mp3`, duration: audioDuration },
        });
        await this.updateRendering(renderingId, 'PROCESSING', progress);
        await job.updateProgress(progress);
      }

      await this.updateRendering(renderingId, 'PROCESSING', 60);
      await job.updateProgress(60);
      log('✓ Audio generation complete');

      const renderDir  = path.join(STORAGE_PATH, 'projects', projectId, 'renders');
      ensureDir(renderDir);
      const outputPath = path.join(renderDir, `${renderingId}.mp4`);

      log(`Assembling ${mode} video...`);
      await this.updateRendering(renderingId, 'PROCESSING', 65);
      await job.updateProgress(65);

      if (mode === 'NO_FACE') {
        await assembleNoFaceVideo(renderingId, project.scenes, project.slides, audioDir, outputPath);
      } else {
        await assembleAvatarVideo(renderingId, project.scenes, project.avatar, audioDir, outputPath);
      }

      await this.updateRendering(renderingId, 'PROCESSING', 90);
      await job.updateProgress(90);
      log('✓ Video assembled');

      // ── Step 5: Finalize ───────────────────────────────────────────────────
      // FIX: the old code jumped straight from 90 → COMPLETED in one block.
      //      If any line threw (BigInt serialization, missing file, DB timeout)
      //      the catch handler set progress=0/FAILED but the frontend was
      //      already showing 90% and polling — it never received a terminal
      //      state update, so it appeared stuck at 95% indefinitely.
      //      Fix:
      //        1. Add explicit 95% checkpoint so the frontend sees forward motion
      //        2. Guard fileSize — Prisma may store it as Int/Float, not BigInt
      //        3. Confirm the output file actually exists before finalizing
      await this.updateRendering(renderingId, 'PROCESSING', 95);
      await job.updateProgress(95);
      log('Finalizing...');

      const videoKey = `projects/${projectId}/renders/${renderingId}.mp4`;
      const videoUrl = `${STORAGE_BASE_URL}/uploads/${videoKey}`;

      // Guard: file must exist — if FFmpeg silently failed outputPath won't exist
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Output file not found after assembly: ${outputPath}`);
      }

      // Guard: BigInt only if Prisma schema uses Int/BigInt; fall back to number
      let fileSize: bigint | number;
      try {
        fileSize = BigInt(fs.statSync(outputPath).size);
      } catch {
        fileSize = fs.statSync(outputPath).size; // plain number fallback
      }

      const totalDuration = project.scenes.reduce((sum, s) => sum + (s.duration || 5), 0);

      await this.updateRendering(renderingId, 'COMPLETED', 100, {
        videoKey, videoUrl, duration: totalDuration, fileSize, completedAt: new Date(),
      });
      await this.updateProject(projectId, 'COMPLETED');
      await job.updateProgress(100);

      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
      log(`✓ DONE | renderingId=${renderingId} | url=${videoUrl}`);
    } catch (error: any) {
      log(`✗ FAILED | renderingId=${renderingId} | error=${error.message}`);
      await this.updateRendering(renderingId, 'FAILED', 0, {
        errorMessage: error.message, completedAt: new Date(),
      }).catch(() => {});
      await this.updateProject(projectId, 'FAILED').catch(() => {});
      try { fs.rmSync(path.join(TEMP_DIR, renderingId), { recursive: true, force: true }); } catch {}
      throw error;
    }
  }
}