import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
   *
   * The jobId is the report row id, so a re-enqueue (failed → pending)
   * shares its identity with the original job. BullMQ deduplicates by
   * jobId on add, so the in-flight retry of the previous run and the
   * new run cannot both execute in parallel.
   */
  async createAndEnqueue(taskId: string, options: CreateAndEnqueueOptions = {}): Promise<void> {
    let reportId: string;
    const existing = await this.prisma.reports.findFirst({ where: { task_id: taskId } });
    if (existing === null) {
      const created = await this.prisma.reports.create({
        data: { id: randomUUID(), task_id: taskId, status: 'pending' },
      });
      reportId = created.id;
    } else if (existing.status === 'pending' || existing.status === 'processing') {
      return;
    } else if (existing.status === 'failed') {
      const updated = await this.prisma.reports.update({
        where: { id: existing.id },
        data: { status: 'pending', error_message: null },
      });
      reportId = updated.id;
    } else if (existing.status === 'completed' && !options.force) {
      return;
    } else if (existing.status === 'completed' && options.force) {
      // Force re-run must reset the row so the worker does not bail
      // out at its defensive "already completed" check.
      const updated = await this.prisma.reports.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          pdf_path: null,
          word_path: null,
          error_message: null,
        },
      });
      reportId = updated.id;
    } else {
      reportId = existing.id;
    }

    await this.queue.add(
      'generate',
      { taskId, reportId },
      {
        jobId: reportId,
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

  /**
   * Confirm the requesting user is allowed to download artifacts
   * for a task. The task creator and any active admin may read
   * the report; everyone else gets 403 so we don't leak task
   * existence via a 404-vs-403 oracle.
   */
  async assertCanDownload(
    taskId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'admin') return;
    const task = await this.prisma.review_tasks.findFirst({
      where: { id: taskId },
      select: { creator_id: true },
    });
    if (!task) throw new NotFoundException('Report not found');
    if (task.creator_id !== userId) {
      throw new ForbiddenException('You do not have access to this report');
    }
  }
}
