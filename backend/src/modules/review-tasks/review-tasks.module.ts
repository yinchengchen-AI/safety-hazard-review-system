import { Module } from '@nestjs/common';
import { ReviewTasksService } from './review-tasks.service';
import { ReviewTasksController } from './review-tasks.controller';

@Module({
  providers: [ReviewTasksService],
  controllers: [ReviewTasksController],
  exports: [ReviewTasksService],
})
export class ReviewTasksModule {}
