import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * P2-3: soft-deletes notifications older than 30 days that the user
 * has already read. Runs daily at 03:00 (Asia/Shanghai) via the
 * @nestjs/schedule cron registration. The previous BullMQ
 * processor route was removed because it duplicated the cron and
 * could double-execute the cleanup if both ran.
 */
@Injectable()
export class NotificationCleanupProcessor {
  private readonly logger = new Logger(NotificationCleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledCleanup(): Promise<void> {
    await this.run();
  }

  private async run(): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const result = await this.prisma.notifications.updateMany({
      where: {
        is_read: true,
        read_at: { lt: cutoff },
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });
    this.logger.log(`soft-deleted ${result.count} old read notifications`);
    return { deleted: result.count };
  }
}
