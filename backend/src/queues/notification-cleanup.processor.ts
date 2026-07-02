import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Soft-deletes notifications older than 30 days that the user has
 * already read. Runs daily at 03:00 (Asia/Shanghai).
 *
 * Implementation note: the BullMQ repeatable job runs in the same
 * worker as the report queue. The pattern below (``Cron`` from
 * @nestjs/schedule) is a fallback so a deployment that hasn't wired
 * BullMQ yet still gets the cleanup.
 */
@Processor('notification-queue')
export class NotificationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationCleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<{ deleted: number }> {
    return this.run();
  }

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
