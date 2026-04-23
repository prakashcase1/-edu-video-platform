import { Module } from '@nestjs/common';
import { RenderingController } from './rendering.controller';
import { RenderingService } from './rendering.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [RenderingController],
  providers: [RenderingService],
  exports: [RenderingService],
})
export class RenderingModule {}
