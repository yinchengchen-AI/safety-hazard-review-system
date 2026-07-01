import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { REPORT_QUEUE } from './bullmq.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReportRenderer } from './report-renderer';

@Processor(REPORT_QUEUE, { concurrency: 1 })
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly renderer: ReportRenderer,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string }>): Promise<void> {
    const { taskId } = job.data;
    this.logger.log(`generating report for task ${taskId}`);
    const report = await this.prisma.reports.findFirst({ where: { task_id: taskId } });
    if (!report) {
      this.logger.warn(`report row missing for task ${taskId}; skipping`);
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

      const pdf = await this.renderer.renderPdf(t, taskHazards);
      const docx = await this.renderer.renderDocx(t, taskHazards);

      const pdfKey = `reports/${taskId}/${randomUUID()}.pdf`;
      const docxKey = `reports/${taskId}/${randomUUID()}.docx`;
      await this.storage.putObject(pdfKey, pdf, 'application/pdf');
      await this.storage.putObject(docxKey, docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

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
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`report ${report.id} failed: ${message}`);
      await this.prisma.reports.update({
        where: { id: report.id },
        data: { status: 'failed', error_message: message },
      });
      // Re-throw so BullMQ can retry per its backoff policy.
      throw err;
    }
  }

}
