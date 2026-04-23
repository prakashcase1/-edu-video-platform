import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  SetAvatarConfigDto,
  SetVoiceConfigDto,
  ProjectQueryDto,
} from './dto/project.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects for current user' })
  async findAll(@CurrentUser('id') userId: string, @Query() query: ProjectQueryDto) {
    return this.projectsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific project' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.projectsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project details' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.projectsService.delete(id, userId);
  }

  @Post(':id/avatar-config')
  @ApiOperation({ summary: 'Set avatar configuration for project' })
  async setAvatarConfig(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SetAvatarConfigDto,
  ) {
    return this.projectsService.setAvatarConfig(id, userId, dto);
  }

  @Post(':id/voice-config')
  @ApiOperation({ summary: 'Set voice configuration for project' })
  async setVoiceConfig(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SetVoiceConfigDto,
  ) {
    return this.projectsService.setVoiceConfig(id, userId, dto);
  }

  @Post(':id/slides')
  @UseInterceptors(FilesInterceptor('slides', 50))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload slides for project' })
  async uploadSlides(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|gif|webp|pdf|pptx|vnd.openxmlformats-officedocument.presentationml.presentation)/ }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.projectsService.uploadSlides(id, userId, files);
  }

  @Put(':id/slides/reorder')
  @ApiOperation({ summary: 'Reorder slides' })
  async reorderSlides(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { slideOrder: { id: string; order: number }[] },
  ) {
    return this.projectsService.reorderSlides(id, userId, body.slideOrder);
  }

  @Delete(':id/slides/:slideId')
  @ApiOperation({ summary: 'Delete a slide' })
  async deleteSlide(
    @Param('id') id: string,
    @Param('slideId') slideId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.deleteSlide(id, userId, slideId);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Generate share link' })
  async generateShareLink(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.projectsService.generateShareLink(id, userId);
  }

  @Public()
  @Get('share/:token')
  @ApiOperation({ summary: 'Get shared project by token' })
  async getSharedProject(@Param('token') token: string) {
    return this.projectsService.findByShareToken(token);
  }
}
