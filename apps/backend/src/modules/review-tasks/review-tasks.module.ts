import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ReviewTasksService } from './review-tasks.service';
import { ReviewTasksController } from './review-tasks.controller';

@Module({
  imports: [ReportsModule, NotificationsModule, AuditLogsModule],
  providers: [ReviewTasksService],
  controllers: [ReviewTasksController],
  exports: [ReviewTasksService],
})
export class ReviewTasksModule {}
