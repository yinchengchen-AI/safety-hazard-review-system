import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: StorageService,
  ) {}

  @Post(':taskId/generate')
  async generate(@Param('taskId') taskId: string): Promise<{ task_id: string; message: string }> {
    await this.reports.createAndEnqueue(taskId, { force: true });
    return { task_id: taskId, message: 'Report generation started' };
  }

  @Get(':taskId/status')
  status(@Param('taskId') taskId: string) {
    return this.reports.getStatus(taskId);
  }

  /**
   * Download the generated report. ``?format=`` picks between PDF
   * and Word; the default is PDF (the document the system is
   * primarily expected to produce). The ``?format=`` query is
   * bound to a decorated parameter, NOT relied on via
   * ``res.req.query``, so the type is enforced at the Nest
   * validation layer and a malformed value becomes a 400.
   */
  @Get(':taskId/download')
  async download(
    @Param('taskId') taskId: string,
    @Query('format') format: 'word' | 'pdf' = 'pdf',
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reports.getStatus(taskId);
    if (report.status !== 'completed') {
      res.status(404).json({ detail: 'Report not ready', status_code: 404 });
      return;
    }
    const isPdf = format === 'pdf';
    const key = isPdf ? report.pdf_path : report.word_path;
    if (!key) {
      res.status(404).json({ detail: `${isPdf ? 'pdf' : 'word'} report not available`, status_code: 404 });
      return;
    }
    const body = await this.storage.getObject(key);
    res.setHeader(
      'Content-Type',
      isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report_${taskId}.${isPdf ? 'pdf' : 'docx'}"`,
    );
    res.send(body);
  }
}
