import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface TtsOptions {
  voiceId: string;
  speed?: number;
  pitch?: number;
  language?: string;
}

export interface AvatarOptions {
  avatarId: string;
  audioUrl: string;
  scriptText: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly elevenLabsApiKey: string;
  private readonly didApiKey: string;
  private readonly tempDir: string;

  constructor(private readonly configService: ConfigService) {
    this.elevenLabsApiKey = this.configService.get<string>('elevenlabs.apiKey');
    this.didApiKey = this.configService.get<string>('did.apiKey');
    this.tempDir = this.configService.get<string>('ffmpeg.tempDir', '/tmp/edu-video');
    this.ensureTempDir();
  }

  async generateSpeech(text: string, options: TtsOptions, outputPath: string): Promise<string> {
    if (this.elevenLabsApiKey) {
      return this.generateElevenLabsSpeech(text, options, outputPath);
    }
    return this.generateGTtsFallback(text, options, outputPath);
  }

  async generateAvatarVideo(options: AvatarOptions, outputPath: string): Promise<string> {
    if (this.didApiKey) {
      return this.generateDIdAvatar(options, outputPath);
    }
    return this.generateMockAvatarVideo(options, outputPath);
  }

  async listVoices(): Promise<any[]> {
    if (this.elevenLabsApiKey) {
      try {
        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': this.elevenLabsApiKey },
        });
        return response.data.voices.map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          preview_url: v.preview_url,
          labels: v.labels,
          // FIX: ElevenLabs stores gender inside labels.gender.
          // Without this, gender is undefined on every voice → the auto-select
          // in StepVoice.tsx always falls through to voices[0] (which is female)
          // instead of picking the voice that matches the chosen avatar.
          gender: (v.labels?.gender as string | undefined)?.toLowerCase() || 'neutral',
        }));
      } catch (error) {
        this.logger.error('Failed to fetch ElevenLabs voices', error);
      }
    }
    return this.getMockVoices();
  }

  listAvatars(): any[] {
    return [
      { id: 'avatar_alex',     name: 'Alex',     gender: 'male',   ethnicity: 'caucasian', previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=533&fit=crop&crop=face' },
      { id: 'avatar_sophia',   name: 'Sophia',   gender: 'female', ethnicity: 'asian',     previewUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=533&fit=crop&crop=face' },
      { id: 'avatar_marcus',   name: 'Marcus',   gender: 'male',   ethnicity: 'african',   previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=533&fit=crop&crop=face' },
      { id: 'avatar_isabella', name: 'Isabella', gender: 'female', ethnicity: 'hispanic',  previewUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=533&fit=crop&crop=face' },
      { id: 'avatar_chen',     name: 'Chen',     gender: 'male',   ethnicity: 'asian',     previewUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=533&fit=crop&crop=face' },
      { id: 'avatar_amara',    name: 'Amara',    gender: 'female', ethnicity: 'african',   previewUrl: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=533&fit=crop&crop=face' },
    ];
  }

  private async generateElevenLabsSpeech(
    text: string,
    options: TtsOptions,
    outputPath: string,
  ): Promise<string> {
    const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM';

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
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
        },
      );

      fs.writeFileSync(outputPath, Buffer.from(response.data));
      this.logger.log(`ElevenLabs TTS generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('ElevenLabs TTS failed, falling back to gTTS', error);
      return this.generateGTtsFallback(text, options, outputPath);
    }
  }

  private async generateGTtsFallback(
    text: string,
    options: TtsOptions,
    outputPath: string,
  ): Promise<string> {
    const lang = options.language || 'en';
    const encodedText = encodeURIComponent(text.substring(0, 200));

    return new Promise((resolve, reject) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;
      const file = fs.createWriteStream(outputPath);

      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          this.logger.log(`gTTS fallback generated: ${outputPath}`);
          resolve(outputPath);
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        this.logger.error('gTTS fallback failed, generating silence', err);
        this.generateSilentAudio(outputPath, this.estimateDuration(text))
          .then(resolve)
          .catch(reject);
      });
    });
  }

  private async generateSilentAudio(outputPath: string, durationSeconds: number): Promise<string> {
    const { execSync } = require('child_process');
    const ffmpegPath = this.configService.get<string>('ffmpeg.path', 'ffmpeg');

    try {
      execSync(
        `${ffmpegPath} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${durationSeconds} -y "${outputPath}"`,
        { stdio: 'pipe' },
      );
      return outputPath;
    } catch {
      fs.writeFileSync(outputPath, Buffer.alloc(0));
      return outputPath;
    }
  }

  private async generateDIdAvatar(options: AvatarOptions, outputPath: string): Promise<string> {
    try {
      const createResponse = await axios.post(
        'https://api.d-id.com/talks',
        {
          source_url: `https://placehold.co/512x512?text=${options.avatarId}`,
          script: {
            type: 'audio',
            audio_url: options.audioUrl,
          },
          config: { fluent: true, pad_audio: 0.0 },
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.didApiKey).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const talkId = createResponse.data.id;

      let videoUrl = '';
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusResponse = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(this.didApiKey).toString('base64')}`,
          },
        });

        if (statusResponse.data.status === 'done') {
          videoUrl = statusResponse.data.result_url;
          break;
        }
        if (statusResponse.data.status === 'error') {
          throw new Error('D-ID avatar generation failed');
        }
      }

      if (!videoUrl) throw new Error('D-ID avatar generation timed out');

      const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));

      this.logger.log(`D-ID avatar generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('D-ID avatar failed, using mock', error);
      return this.generateMockAvatarVideo(options, outputPath);
    }
  }

  private async generateMockAvatarVideo(options: AvatarOptions, outputPath: string): Promise<string> {
    const { execSync } = require('child_process');
    const ffmpegPath = this.configService.get<string>('ffmpeg.path', 'ffmpeg');
    const duration = this.estimateDuration(options.scriptText);

    try {
      execSync(
        `${ffmpegPath} -f lavfi -i color=c=4A90D9:size=512x512:rate=25 ` +
        `-vf "drawtext=text='${options.avatarId}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2" ` +
        `-t ${duration} -y "${outputPath}"`,
        { stdio: 'pipe' },
      );

      this.logger.log(`Mock avatar video generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('Mock avatar generation failed', error);
      throw error;
    }
  }

  private getMockVoices(): any[] {
    return [
      { id: 'voice_en_male_001',   name: 'Guy (English, Male)',      language: 'en', gender: 'male'   },
      { id: 'voice_en_female_001', name: 'Jenny (English, Female)',   language: 'en', gender: 'female' },
      { id: 'voice_en_male_002',   name: 'Christopher (English, Male)',   language: 'en', gender: 'male'   },
      { id: 'voice_en_female_002', name: 'Aria (English, Female)',    language: 'en', gender: 'female' },
      { id: 'voice_hi_female_001', name: 'Swara (Hindi, Female)',     language: 'hi', gender: 'female' },
      { id: 'voice_es_female_001', name: 'Elvira (Spanish, Female)',  language: 'es', gender: 'female' },
      { id: 'voice_fr_female_001', name: 'Denise (French, Female)',   language: 'fr', gender: 'female' },
      { id: 'voice_de_male_001',   name: 'Conrad (German, Male)',     language: 'de', gender: 'male'   },
    ];
  }

  private estimateDuration(text: string): number {
    const words = text.split(' ').length;
    return Math.max(3, Math.ceil((words / 150) * 60));
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
}