import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ReviewTasksService } from './review-tasks.service';
import { ReviewTasksController } from './review-tasks.controller';

@Module({
  imports: [ReportsModule],
  providers: [ReviewTasksService],
  controllers: [ReviewTasksController],
  exports: [ReviewTasksService],
})
export class ReviewTasksModule {}
