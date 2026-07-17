import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: StorageService,
  ) {}

  @Post(':taskId/generate')
  async generate(
    @Param('taskId') taskId: string,
    @CurrentUser() user: users,
  ): Promise<{ task_id: string; message: string }> {
    await this.reports.assertCanDownload(taskId, user.id, user.role);
    await this.reports.createAndEnqueue(taskId, { force: true });
    return { task_id: taskId, message: 'Report generation started' };
  }

  @Get(':taskId/status')
  async status(
    @Param('taskId') taskId: string,
    @CurrentUser() user: users,
  ) {
    await this.reports.assertCanDownload(taskId, user.id, user.role);
    return this.reports.getStatus(taskId);
  }

  /**
   * Download the generated report. ``?format=`` picks between PDF
   * and Word; the default is PDF (the document the system is
   * primarily expected to produce). The ``?format=`` query is
   * bound to a decorated parameter, NOT relied on via
   * ``res.req.query``, so the type is enforced at the Nest
   * validation layer and a malformed value becomes a 400.
   *
   * Only the task creator and active admins can download. 403 is
   * returned for non-allowed users (after the existence check) so
   * we don't leak task existence via a 404-vs-403 oracle.
   */
  @Get(':taskId/download')
  async download(
    @Param('taskId') taskId: string,
    @Query('format') format: 'word' | 'pdf' = 'pdf',
    @CurrentUser() user: users,
    @Res() res: Response,
  ): Promise<void> {
    await this.reports.assertCanDownload(taskId, user.id, user.role);
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
    let body: Buffer;
    try {
      body = await this.storage.getObject(key);
    } catch {
      // The DB row exists with a path, but the underlying object is
      // missing — usually a leftover after a failed worker run. Tell
      // the caller the file isn't available rather than 500.
      res.status(404).json({ detail: 'Report file not found in storage', status_code: 404 });
      return;
    }
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
