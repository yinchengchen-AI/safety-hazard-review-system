import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { REPORT_QUEUE } from './bullmq.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReportRenderer } from './report-renderer';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Processor(REPORT_QUEUE, { concurrency: 2 })
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly renderer: ReportRenderer,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string; reportId: string }>): Promise<void> {
    const { taskId, reportId } = job.data;
    if (job.attemptsMade > 0) {
      // Defensive: a retry should only run if the report is still
      // marked failed (a successful first attempt would have moved
      // it to completed; skip in that case to avoid double work).
      const current = await this.prisma.reports.findFirst({ where: { id: reportId } });
      if (!current || current.status === 'completed') {
        this.logger.log(`job ${job.id} already completed; skipping retry`);
        return;
      }
    }

    this.logger.log(`generating report for task ${taskId} (reportId=${reportId})`);
    const report = await this.prisma.reports.findFirst({ where: { id: reportId } });
    if (!report) {
      this.logger.warn(`report row ${reportId} missing; skipping`);
      return;
    }
    await this.prisma.reports.update({
      where: { id: report.id },
      data: { status: 'processing' },
    });
    try {
      const t = await this.prisma.review_tasks.findFirst({
        where: { id: taskId },
        include: { users: true },
      });
      if (!t) throw new Error(`task ${taskId} not found`);
      const taskHazards = await this.prisma.task_hazards.findMany({
        where: { task_id: taskId },
        include: { hazards: { include: { enterprises: true, batches: true } } },
      });

      const [pdf, docx] = await Promise.all([
        this.renderer.renderPdf(t, taskHazards),
        this.renderer.renderDocx(t, taskHazards),
      ]);

      const pdfKey = `reports/${taskId}/${randomUUID()}.pdf`;
      const docxKey = `reports/${taskId}/${randomUUID()}.docx`;
      await Promise.all([
        this.storage.putObject(pdfKey, pdf, 'application/pdf'),
        this.storage.putObject(
          docxKey,
          docx,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ]);

      await this.prisma.reports.update({
        where: { id: report.id },
        data: {
          status: 'completed',
          pdf_path: pdfKey,
          word_path: docxKey,
          generated_at: new Date(),
          error_message: null,
        },
      });
      this.logger.log(`report ${report.id} completed`);

      try {
        const adminIds = await this.notifications.findAdminUserIds();
        const recipients = Array.from(new Set([t.creator_id, ...adminIds].filter(Boolean)));
        await this.notifications.notify(
          'report_completed',
          `复核任务「${t.name}」的报告已生成`,
          recipients,
          { related: { type: 'report', id: report.id }, force: true },
        );
      } catch (err) {
        this.logger.warn(`report_completed notify failed: ${(err as Error).message}`);
      }
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`report ${report.id} failed: ${message}`);
      await this.prisma.reports.update({
        where: { id: report.id },
        data: { status: 'failed', error_message: message },
      });
      throw err;
    }
  }
}
