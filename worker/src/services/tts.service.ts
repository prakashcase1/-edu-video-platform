import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface TtsOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  language?: string;
}

// FIX: Default to Adam (neutral male) instead of Rachel (female).
// This is only used when no voiceId is provided at all.
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — ElevenLabs premade male voice

export class TtsService {
  private readonly elevenLabsApiKey: string;
  private readonly ffmpegPath: string;

  constructor() {
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    console.log(`[TTS] ElevenLabs key loaded: ${this.elevenLabsApiKey ? 'YES ✅' : 'NO ❌'}`);
  }

  async generateSpeech(text: string, options: TtsOptions, outputPath: string): Promise<string> {
    console.log(`[TTS] Generating speech for text (${text.length} chars), voiceId=${options.voiceId || 'default'}`);

    // FIX: was `if (this.elevenLabsApiKey && options.voiceId)` — the second
    // condition meant that whenever voiceConfig.voiceId was null/undefined
    // (e.g. voice step skipped, or DB column not yet populated), ElevenLabs
    // was bypassed entirely and Google TTS was used instead. Google TTS has no
    // voice selection — it always returns the same default voice (sounds female),
    // so the user's voice choice had zero effect on the rendered audio.
    // Fix: require only the API key. The voiceId fallback is handled inside
    // generateElevenLabs() so a missing voiceId still produces correct audio.
    if (this.elevenLabsApiKey) {
      try {
        return await this.generateElevenLabs(text, options, outputPath);
      } catch (err) {
        console.warn('[TTS] ElevenLabs failed, falling back:', err.message);
      }
    }

    try {
      return await this.generateEdgeTts(text, options, outputPath);
    } catch (err) {
      console.warn('[TTS] Edge TTS failed, generating silence:', (err as any).message);
      return this.generateSilence(text, outputPath);
    }
  }

  private async generateElevenLabs(
    text: string,
    options: TtsOptions,
    outputPath: string,
  ): Promise<string> {
    // FIX: was '21m00Tcm4TlvDq8ikWAM' (Rachel, female) as the hardcoded
    // fallback. Now falls back to DEFAULT_VOICE_ID (Adam, male/neutral) so
    // even without an explicit voiceId the output isn't always female.
    const voiceId = options.voiceId || DEFAULT_VOICE_ID;

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key': this.elevenLabsApiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      },
    );

    // Write raw mp3 first, then apply speed/pitch via FFmpeg
    const mp3Path = outputPath.replace(/\.(wav|mp3)$/, '_raw.mp3');
    fs.writeFileSync(mp3Path, Buffer.from(response.data));

    // FIX: speed and pitch from the wizard were saved to the DB but never
    // applied during generation. ElevenLabs doesn't expose speed/pitch params
    // in its standard API, so we apply them as FFmpeg audio filters instead.
    const speed = options.speed ?? 1.0;
    const pitch = options.pitch ?? 1.0;
    const needsFilter = speed !== 1.0 || pitch !== 1.0;

    if (needsFilter) {
      // atempo range is 0.5–2.0 (matches the UI slider range exactly).
      // asetrate shifts pitch: multiply sample rate by pitch factor, then
      // resample back to 44100 so downstream tools see a standard rate.
      const filters = [
        pitch !== 1.0 ? `asetrate=44100*${pitch.toFixed(3)},aresample=44100` : null,
        speed !== 1.0 ? `atempo=${speed.toFixed(3)}` : null,
      ].filter(Boolean).join(',');

      const finalPath = outputPath.endsWith('.wav') ? outputPath : outputPath.replace('_raw.mp3', '.mp3');
      execSync(
        `${this.ffmpegPath} -i "${mp3Path}" -af "${filters}" -ar 44100 -ac 2 -y "${finalPath}"`,
        { stdio: 'pipe' },
      );
      fs.unlinkSync(mp3Path);
      if (finalPath !== outputPath) fs.renameSync(finalPath, outputPath);
    } else {
      // No filter needed — just move/convert
      if (outputPath.endsWith('.wav')) {
        execSync(`${this.ffmpegPath} -i "${mp3Path}" -y "${outputPath}"`, { stdio: 'pipe' });
        fs.unlinkSync(mp3Path);
      } else {
        fs.renameSync(mp3Path, outputPath);
      }
    }

    console.log(`[TTS] ElevenLabs generated: ${outputPath} (speed=${speed}, pitch=${pitch})`);
    return outputPath;
  }

  // ─── Edge TTS voice map ───────────────────────────────────────────────────
  // Maps the voice IDs returned by ai.service.ts getMockVoices() to real
  // Microsoft Edge TTS voice names. These work with no API key.
  private readonly EDGE_VOICE_MAP: Record<string, string> = {
    'voice_en_female_001': 'en-US-JennyNeural',      // Rachel → Jenny (female)
    'voice_en_male_001':   'en-US-GuyNeural',         // Marcus → Guy (male)
    'voice_en_female_002': 'en-US-AriaNeural',        // Emma → Aria (female)
    'voice_en_male_002':   'en-US-ChristopherNeural', // James → Christopher (male)
    'voice_es_female_001': 'es-ES-ElviraNeural',      // Sofia (Spanish)
    'voice_fr_female_001': 'fr-FR-DeniseNeural',      // Camille (French)
    'voice_hi_female_001': 'hi-IN-SwaraNeural',       // Hindi female
    'voice_de_male_001':   'de-DE-ConradNeural',      // German male
  };

  private getEdgeVoice(voiceId: string | undefined, language: string): string {
    if (voiceId && this.EDGE_VOICE_MAP[voiceId]) {
      return this.EDGE_VOICE_MAP[voiceId];
    }
    // Language fallbacks
    const langDefaults: Record<string, string> = {
      en: 'en-US-GuyNeural',
      es: 'es-ES-ElviraNeural',
      fr: 'fr-FR-DeniseNeural',
      de: 'de-DE-ConradNeural',
      hi: 'hi-IN-SwaraNeural',
      zh: 'zh-CN-YunxiNeural',
      ja: 'ja-JP-KeitaNeural',
      ar: 'ar-SA-HamedNeural',
      pt: 'pt-BR-AntonioNeural',
    };
    return langDefaults[language] || 'en-US-GuyNeural';
  }

  private async generateEdgeTts(
    text: string,
    options: TtsOptions,
    outputPath: string,
  ): Promise<string> {
    const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
    const tts = new MsEdgeTTS();
    const voice = this.getEdgeVoice(options.voiceId, options.language || 'en');

    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    // toFile() takes a DIRECTORY and saves as {dir}/audio.mp3
    const rawDir = outputPath + '_edgedir';
    fs.mkdirSync(rawDir, { recursive: true });
    await tts.toFile(rawDir, text);
    const rawPath = path.join(rawDir, 'audio.mp3');

    // Apply speed/pitch via FFmpeg if needed
    const speed = options.speed ?? 1.0;
    const pitch = options.pitch ?? 1.0;
    const needsFilter = speed !== 1.0 || pitch !== 1.0;

    if (needsFilter) {
      const filters = [
        pitch !== 1.0 ? `asetrate=44100*${pitch.toFixed(3)},aresample=44100` : null,
        speed !== 1.0 ? `atempo=${speed.toFixed(3)}` : null,
      ].filter(Boolean).join(',');
      execSync(
        `${this.ffmpegPath} -i "${rawPath}" -af "${filters}" -ar 44100 -ac 2 -y "${outputPath}"`,
        { stdio: 'pipe' },
      );
    } else {
      execSync(
        `${this.ffmpegPath} -i "${rawPath}" -ar 44100 -ac 2 -y "${outputPath}"`,
        { stdio: 'pipe' },
      );
    }
    // Clean up temp directory
    try { fs.rmSync(rawDir, { recursive: true, force: true }); } catch {}

    console.log(`[TTS] Edge TTS generated: ${outputPath} (voice=${voice}, speed=${speed})`);
    return outputPath;
  }

  private generateSilence(text: string, outputPath: string): string {
    const words = text.split(/\s+/).length;
    const duration = Math.max(2, Math.ceil((words / 150) * 60));

    execSync(
      `${this.ffmpegPath} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${duration} -y "${outputPath}"`,
      { stdio: 'pipe' },
    );

    console.log(`[TTS] Silence generated: ${outputPath} (${duration}s)`);
    return outputPath;
  }

  private chunkText(text: string, maxLen: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxLen) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }

    if (current) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }
}