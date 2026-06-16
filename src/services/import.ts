import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CaseService } from './case';

const RowSchema = z.object({
  name: z.string().min(1),
  unifiedSocialCreditId: z.string().regex(/^[0-9A-Z]{18}$/),
  hazardTypeCode: z.string().min(1),
  severity: z.enum(['MAJOR', 'MODERATE', 'MINOR']),
  source: z.string().min(1),
  description: z.string().min(1),
  address: z.string().optional(),
  deadline: z.coerce.date(),
});

export type ImportRow = z.infer<typeof RowSchema>;

export const ImportService = {
  async parseExcel(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<{
    rows: ImportRow[];
    errors: { rowNumber: number; field: string; value?: string; message: string }[];
  }> {
    const wb = new ExcelJS.Workbook();
    const buf = (Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer as ArrayBuffer))); await wb.xlsx.load(buf as never);
    const ws = wb.worksheets[0];
    if (!ws) {
      return { rows: [], errors: [{ rowNumber: 0, field: 'sheet', message: 'No worksheet' }] };
    }

    const headerMap: Record<number, string> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const v = cell.value?.toString().trim();
      if (v) headerMap[col] = v;
    });

    const rows: ImportRow[] = [];
    const errors: { rowNumber: number; field: string; value?: string; message: string }[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw: Record<string, unknown> = {};
      row.eachCell((cell, col) => {
        const key = headerMap[col];
        if (key) raw[key] = cell.value;
      });
      const mapped = {
        name: raw['企业名称'],
        unifiedSocialCreditId: raw['统一社会信用代码'],
        hazardTypeCode: raw['隐患类型编码'],
        severity: raw['严重程度'],
        source: raw['来源'],
        description: raw['描述'],
        address: raw['地址'],
        deadline: raw['整改期限'],
      };
      const parsed = RowSchema.safeParse(mapped);
      if (parsed.success) {
        rows.push(parsed.data);
      } else {
        for (const issue of parsed.error.issues) {
          const fieldKey = issue.path[0] as keyof typeof mapped | undefined;
          errors.push({
            rowNumber,
            field: issue.path.join('.'),
            value: String(fieldKey ? (mapped[fieldKey] ?? '') : ''),
            message: issue.message,
          });
        }
      }
    });
    return { rows, errors };
  },

  async commit(rows: ImportRow[], batchId: string, actorId: string) {
    let success = 0;
    let failed = 0;
    for (const r of rows) {
      try {
        const enterprise = await prisma.enterprise.upsert({
          where: { unifiedSocialCreditId: r.unifiedSocialCreditId },
          update: {},
          create: {
            name: r.name,
            unifiedSocialCreditId: r.unifiedSocialCreditId,
            address: r.address,
          },
        });
        const hazardType = await prisma.hazardType.findUnique({ where: { code: r.hazardTypeCode } });
        if (!hazardType) throw new Error(`Unknown hazard type: ${r.hazardTypeCode}`);
        const template = await prisma.checklistTemplate.findFirst({
          where: { hazardTypeId: hazardType.id, active: true },
        });
        if (!template) throw new Error(`No active template for ${r.hazardTypeCode}`);
        await CaseService.register(
          {
            enterpriseId: enterprise.id,
            hazardTypeId: hazardType.id,
            severity: r.severity,
            source: r.source,
            description: r.description,
            address: r.address,
            deadline: r.deadline,
            templateId: template.id,
            reviewerId: actorId,
          },
          actorId,
        );
        success++;
      } catch (e) {
        failed++;
        const message = e instanceof Error ? e.message : String(e);
        await prisma.importError.create({
          data: { batchId, rowNumber: success + failed, field: 'row', message },
        });
      }
    }
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        successCount: success,
        failedCount: failed,
        status: failed === 0 ? 'completed' : 'partial',
      },
    });
    return { success, failed };
  },
};
