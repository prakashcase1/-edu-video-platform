import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('voices')
  @ApiOperation({ summary: 'List available TTS voices' })
  async listVoices() {
    return this.aiService.listVoices();
  }

  @Get('avatars')
  @ApiOperation({ summary: 'List available avatars' })
  async listAvatars() {
    return this.aiService.listAvatars();
  }
}
