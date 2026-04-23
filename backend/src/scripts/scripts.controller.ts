import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScriptsService } from './scripts.service';

class UpsertScriptDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

class MapSceneSlideDto {
  @IsString()
  @IsNotEmpty()
  sceneId: string;

  @IsString()
  @IsOptional()
  slideId?: string;
}

@ApiTags('scripts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Put()
  @ApiOperation({ summary: 'Save or update script for a project' })
  async upsertScript(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertScriptDto,
  ) {
    return this.scriptsService.upsertScript(projectId, userId, dto.content);
  }

  @Get()
  @ApiOperation({ summary: 'Get script for a project' })
  async getScript(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.scriptsService.getScript(projectId, userId);
  }

  @Post('parse')
  @ApiOperation({ summary: 'Parse script into scenes using AI' })
  async parseScript(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.scriptsService.parseScript(projectId, userId);
  }

  @Get('mappings')
  @ApiOperation({ summary: 'Get scene-slide mappings for a project' })
  async getMappings(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.scriptsService.getScriptMappings(projectId, userId);
  }

  @Put('map-scene-slide')
  @ApiOperation({ summary: 'Map a scene to a slide' })
  async mapSceneToSlide(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: MapSceneSlideDto,
  ) {
    return this.scriptsService.mapSceneToSlide(projectId, userId, dto.sceneId, dto.slideId);
  }
}
