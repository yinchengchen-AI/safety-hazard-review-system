import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { REPORT_QUEUE } from '../../queues/bullmq.module';

export interface CreateAndEnqueueOptions {
  force?: boolean;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORT_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Idempotently enqueue a report job for a task.
   * - No report row yet → create + enqueue.
   * - pending/processing → no-op (already in flight).
   * - failed → reset to pending, re-enqueue.
   * - completed → no-op unless force=true.
   */
  async createAndEnqueue(taskId: string, options: CreateAndEnqueueOptions = {}): Promise<void> {
    const existing = await this.prisma.reports.findFirst({ where: { task_id: taskId } });
    if (existing === null) {
      await this.prisma.reports.create({
        data: { id: randomUUID(), task_id: taskId, status: 'pending' },
      });
    } else if (existing.status === 'pending' || existing.status === 'processing') {
      return;
    } else if (existing.status === 'failed') {
      await this.prisma.reports.update({
        where: { id: existing.id },
        data: { status: 'pending', error_message: null },
      });
    } else if (existing.status === 'completed' && !options.force) {
      return;
    }
    await this.queue.add(
      'generate',
      { taskId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
  }

  async getStatus(taskId: string) {
    const report = await this.prisma.reports.findFirst({ where: { task_id: taskId } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
