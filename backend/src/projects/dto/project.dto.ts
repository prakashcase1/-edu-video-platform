import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoMode } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'Introduction to Algebra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'A beginner-friendly algebra course' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: VideoMode, default: VideoMode.NO_FACE })
  @IsEnum(VideoMode)
  @IsOptional()
  mode?: VideoMode;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: VideoMode })
  @IsEnum(VideoMode)
  @IsOptional()
  mode?: VideoMode;
}

export class SetAvatarConfigDto {
  @ApiProperty({ example: 'avatar_001' })
  @IsString()
  @IsNotEmpty()
  avatarId: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  avatarName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  previewUrl?: string;
}

export class SetVoiceConfigDto {
  @ApiProperty({ example: 'voice_en_female_001' })
  @IsString()
  @IsNotEmpty()
  voiceId: string;

  @ApiProperty({ example: 'Rachel' })
  @IsString()
  @IsNotEmpty()
  voiceName: string;

  @ApiPropertyOptional({ default: 1.0 })
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  @IsOptional()
  speed?: number;

  @ApiPropertyOptional({ default: 1.0 })
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  @IsOptional()
  pitch?: number;

  @ApiPropertyOptional({ default: 'en' })
  @IsString()
  @IsOptional()
  language?: string;
}

export class ProjectQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  search?: string;
}
