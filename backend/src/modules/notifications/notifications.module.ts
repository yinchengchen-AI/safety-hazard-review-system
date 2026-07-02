import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationCleanupProcessor } from '../../queues/notification-cleanup.processor';

@Module({
  providers: [NotificationsService, NotificationCleanupProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
