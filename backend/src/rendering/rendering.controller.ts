import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RenderingService } from './rendering.service';

@ApiTags('rendering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/render')
export class RenderingController {
  constructor(private readonly renderingService: RenderingService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start video rendering for a project' })
  async startRendering(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.renderingService.startRendering(projectId, userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current rendering status' })
  async getRenderingStatus(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.renderingService.getRenderingStatus(projectId, userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get rendering history' })
  async getRenderingHistory(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.renderingService.getRenderingHistory(projectId, userId);
  }

  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel active rendering' })
  async cancelRendering(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.renderingService.cancelRendering(projectId, userId);
  }
}
