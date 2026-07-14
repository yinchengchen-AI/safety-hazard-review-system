import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chromium } from 'playwright';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  TextRun,
} from 'docx';

@Injectable()
export class ReportRenderer {
  private readonly logger = new Logger(ReportRenderer.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Render the PDF by converting the report HTML to a binary PDF via
   * Playwright. The caller stores the resulting buffer in MinIO.
   */
  async renderPdf(
    task: { id: string; name: string; created_at: Date | null; users: { username: string } | null },
    taskHazards: Array<{ hazards: { content: string | null; location: string | null; status: string } | null }>,
  ): Promise<Buffer> {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escape(task.name)}</title>
<style>body{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px;text-align:left;vertical-align:top}th{background:#f2f2f2}h1{text-align:center}</style>
</head><body><h1>${this.escape(task.name)}</h1>
<p>任务 ID: ${task.id} | 创建人: ${task.users?.username ?? '-'} | 创建时间: ${task.created_at?.toISOString() ?? '-'}</p>
<table><tr><th>#</th><th>隐患描述</th><th>位置</th><th>状态</th></tr>
${taskHazards
  .map((th, i) => `<tr><td>${i + 1}</td><td>${this.escape(th.hazards?.content ?? '')}</td><td>${this.escape(th.hazards?.location ?? '')}</td><td>${this.escape(th.hazards?.status ?? '')}</td></tr>`)
  .join('')}
</table></body></html>`;

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser?.close().catch((err) => this.logger.warn(`failed to close browser: ${err.message}`));
    }
  }

  async renderDocx(
    task: { id: string; name: string; created_at: Date | null; users: { username: string } | null },
    taskHazards: Array<{ conclusion: string | null; status_in_task: string | null; reviewed_at: Date | null; hazards: { content: string | null; location: string | null; enterprises: { name: string | null } | null } | null }>,
  ): Promise<Buffer> {
    const rows = taskHazards.map(
      (th) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(th.hazards?.enterprises?.name ?? '-')] }),
            new TableCell({ children: [new Paragraph(this.escape(th.hazards?.content ?? ''))] }),
            new TableCell({ children: [new Paragraph(this.escape(th.hazards?.location ?? ''))] }),
            new TableCell({ children: [new Paragraph(this.escape(th.conclusion ?? ''))] }),
            new TableCell({ children: [new Paragraph(this.escape(th.status_in_task ?? '-'))] }),
          ],
        }),
    );
    const table = new Table({
      rows: [
        new TableRow({
          children: ['企业', '隐患描述', '位置', '结论', '状态'].map(
            (h) => new TableCell({ children: [new Paragraph({ text: h, heading: HeadingLevel.HEADING_4 })] }),
          ),
        }),
        ...rows,
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: task.name,
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              children: [
                new TextRun(`任务 ID: ${task.id}    创建人: ${task.users?.username ?? '-'}    创建时间: ${task.created_at?.toISOString() ?? '-'}`),
              ],
            }),
            new Paragraph(''),
            table,
          ],
        },
      ],
    });
    return await Packer.toBuffer(doc);
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
