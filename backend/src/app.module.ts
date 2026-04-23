import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ScriptsModule } from './scripts/scripts.module';
import { RenderingModule } from './rendering/rendering.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long', ttl: 60000, limit: 300 },
    ]),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    ScriptsModule,
    RenderingModule,
    StorageModule,
    QueueModule,
    AiModule,
  ],
})
export class AppModule {}
