import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  BatchImportResultDto,
  BatchListResponseDto,
  BatchPreviewItemDto,
  BatchPreviewRequestDto,
  BatchPreviewResponseDto,
  BatchResponseDto,
  HazardImportRow,
  ImportErrorResponseDto,
} from './dto/batch.dto';

type BatchJoined = any;

function toBatchResponse(
  b: BatchJoined,
  availableHazardCount = 0,
  creatorUsername: string | null = null,
): BatchResponseDto {
  return {
    id: b.id,
    name: b.name,
    import_time: b.import_time,
    file_name: b.file_name,
    total_count: b.total_count ?? 0,
    success_count: b.success_count ?? 0,
    fail_count: b.fail_count ?? 0,
    creator_username: creatorUsername,
    original_file_path: b.original_file_path,
    reporting_unit: b.reporting_unit,
    created_at: b.created_at,
    available_hazard_count: availableHazardCount,
  };
}

const HEADER_MAP: Record<string, keyof HazardImportRow> = {
  '上报单位': 'reporting_unit',
  '行业领域': 'industry_sector',
  '企业类型': 'enterprise_type',
  '企业名称': 'enterprise_name',
  '统一社会信用代码': 'credit_code',
  '属地': 'region',
  '详细地址': 'address',
  '负责人': 'contact_person',
  '隐患分类': 'category',
  '隐患描述': 'description',
  '隐患位置': 'location',
  '检查方式': 'inspection_method',
  '检查人': 'inspector',
  '检查时间': 'inspection_date',
  '判定依据': 'judgment_basis',
  '违反判定依据具体条款': 'violation_clause',
  '是否整改': 'is_rectified',
  '实际整改完成时间': 'rectification_date',
  '整改责任部门/责任人': 'rectification_responsible',
  '整改措施': 'rectification_measures',
  '举报情况备注': 'report_remarks',
};

function normalizeHeader(header: string): string {
  return header.replace(/\s+/g, '').trim();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  values.push(current);
  return values;
}

/** Strip a leading UTF-8 BOM, if present. */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** ExcelJS returns ``cell.value`` in a few shapes:
 *  - ``null`` / primitive — pass through
 *  - rich text: ``{ richText: [{ text: '...' }, ...] }`` — concat
 *  - formula: ``{ formula: '...', result: ... }`` — use the result
 *  - hyperlink: ``{ text: '...', hyperlink: '...' }`` — text
 *  - date: a number (Excel serial). Caller decides how to coerce. */
function cellValueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text: string }>).map((r) => r.text ?? '').join('');
    }
    if ('result' in o) return cellValueToString(o.result);
    if ('text' in o) return cellValueToString(o.text);
    if ('hyperlink' in o && 'text' in o) return cellValueToString(o.text);
  }
  return '';
}

/** Excel serial date (1900-based) → ISO yyyy-mm-dd. Falls back to
 *  the string form of the number for very small / large serials so
 *  an obviously-bad cell is still inspectable. */
function excelSerialToIsoDate(serial: number): string {
  if (!Number.isFinite(serial)) return '';
  // Excel's day 1 is 1900-01-01, with a known off-by-one for the
  // 1900 leap year bug. Unix epoch (1970-01-01) is day 25569.
  const unixDays = serial - 25569;
  if (Math.abs(unixDays) > 365 * 200) return '';
  const ms = unixDays * 86_400_000;
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BatchesService {
  private readonly logger = new Logger(BatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(page: number, pageSize: number): Promise<BatchListResponseDto> {
    const [rows, total] = await Promise.all([
      this.prisma.batches.findMany({
        where: {},
        orderBy: [{ import_time: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { users: true },
      }),
      this.prisma.batches.count({ where: {} }),
    ]);
    if (rows.length === 0) return { items: [], total, page, page_size: pageSize };
    const ids = rows.map((r) => r.id);
    const counts = await this.prisma.hazards.groupBy({
      by: ['batch_id'],
      where: { batch_id: { in: ids }, current_task_id: null },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.batch_id, c._count._all]));
    return {
      items: rows.map((r) =>
        toBatchResponse(r, countMap.get(r.id) ?? 0, r.users?.username ?? null),
      ),
      total,
      page,
      page_size: pageSize,
    };
  }

  async preview(dto: BatchPreviewRequestDto): Promise<BatchPreviewResponseDto> {
    const items: BatchPreviewItemDto[] = dto.rows.map((row, i) => {
      const errors: string[] = [];
      if (!row.enterprise_name || !row.enterprise_name.trim()) {
        errors.push('企业名称不能为空');
      }
      if (!row.description || !row.description.trim()) {
        errors.push('隐患描述不能为空');
      }
      return {
        row_index: i + 2,
        enterprise_name: row.enterprise_name ?? null,
        description: row.description ?? null,
        errors,
      };
    });
    return { total: dto.rows.length, items };
  }

  async import(buffer: Buffer, filename: string, userId: string): Promise<BatchImportResultDto> {
    const rows = await this.parseExcelOrCsv(buffer, filename);
    const MAX_ROWS = 5000;
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`导入行数超过限制（最多 ${MAX_ROWS} 行）`);
    }
    const name = filename.replace(/\.[^.]+$/, '') || `import_${new Date().toISOString().slice(0, 10)}`;

    const safeBase = (filename
      .split(/[\\/]/).pop() ?? 'upload.xlsx')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .slice(0, 120) || 'upload.xlsx';
    const batchId = randomUUID();
    const originalKey = `batches/${batchId}/original/${safeBase}`;
    const contentType = filename.toLowerCase().endsWith('.csv')
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Upload to MinIO BEFORE the transaction starts so the DB
    // transaction stays short. On transaction failure we delete
    // the orphaned object below.
    await this.storage.putObject(originalKey, buffer, contentType);

    const errors: { row_index: number; reason: string }[] = [];
    let success = 0;
    const enterpriseCache = new Map<string, string>();
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const batch = await tx.batches.create({
          data: {
            id: batchId,
            name,
            file_name: filename,
            total_count: rows.length,
            success_count: 0,
            fail_count: 0,
            creator_id: userId,
            original_file_path: originalKey,
          },
        });
        for (let i = 0; i < rows.length; i++) {
          const rowNum = i + 2;
          const row = rows[i];
          const result = await this._processRowInner(tx, batch.id, row, enterpriseCache);
          if (result?.reason) {
            errors.push({ row_index: rowNum, reason: result.reason });
            await tx.import_errors.create({
              data: {
                batch_id: batch.id,
                row_index: rowNum,
                raw_data: JSON.stringify(row),
                reason: result.reason,
              },
            });
          } else {
            success += 1;
          }
        }
        return tx.batches.update({
          where: { id: batch.id },
          data: { success_count: success, fail_count: errors.length },
        });
      }, { timeout: 120_000 });
    } catch (err) {
      await this.storage.deleteObject(originalKey).catch(() => undefined);
      throw err;
    }

    await this.audit.record({
      userId,
      action: 'batch.import',
      targetType: 'batch',
      targetId: updated.id,
      detail: { name, total: rows.length, success, fail: errors.length },
    }).catch(() => undefined);

    return {
      batch: toBatchResponse(updated, 0, null),
      success_count: success,
      fail_count: errors.length,
      errors,
    };
  }

  private async parseExcelOrCsv(buffer: Buffer, filename: string): Promise<HazardImportRow[]> {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      const text = stripBom(buffer.toString('utf-8'));
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(',').map((h) => normalizeHeader(stripBom(h.replace(/^"|"$/g, ''))));
      return lines.slice(1).map((line) => this.mapRow(parseCsvLine(line), headers));
    }

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Excel 文件没有工作表');

    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = normalizeHeader(stripBom(cellValueToString(cell.value)));
    });

    const rows: HazardImportRow[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: string[] = [];
      for (let i = 0; i < headers.length; i++) {
        const cell = row.getCell(i + 1);
        values[i] = cellValueToString(cell.value);
      }
      rows.push(this.mapRow(values, headers));
    });
    return rows;
  }

  private mapRow(values: string[], headers: string[]): HazardImportRow {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = HEADER_MAP[headers[i]];
      if (!key) continue;
      const raw = values[i];
      if (raw === undefined || raw === '') continue;
      row[key] = raw.trim();
    }
    return row as unknown as HazardImportRow;
  }

  private async _processRowInner(
    tx: Prisma.TransactionClient,
    batchId: string,
    row: HazardImportRow,
    enterpriseCache: Map<string, string>,
  ): Promise<{ reason?: string } | null> {
    const name = row.enterprise_name?.trim();
    const desc = row.description?.trim();
    if (!name) return { reason: '企业名称不能为空' };
    if (!desc) return { reason: '隐患描述不能为空' };

    // Find or create the enterprise. When a credit_code is
    // provided it is the authoritative key (the application-level
    // unique constraint on enterprises.credit_code enforces it).
    // When only a name is provided we dedup by name. The cache
    // stores entries under both keys so a name-only import after
    // a credit_code import still finds the same row.
    const cacheKey = row.credit_code ? `credit:${row.credit_code}` : `name:${name}`;
    let enterpriseId = enterpriseCache.get(cacheKey);
    if (!enterpriseId) {
      const enterprise = row.credit_code
        ? await tx.enterprises.findFirst({ where: { credit_code: row.credit_code } })
        : await tx.enterprises.findFirst({ where: { name } });
      if (enterprise) {
        enterpriseId = enterprise.id;
      } else {
        const created = await tx.enterprises.create({
          data: {
            name,
            credit_code: row.credit_code ?? null,
            region: row.region ?? null,
            address: row.address ?? null,
            contact_person: row.contact_person ?? null,
            industry_sector: row.industry_sector ?? null,
            enterprise_type: row.enterprise_type ?? null,
          },
        });
        enterpriseId = created.id;
      }
      enterpriseCache.set(`credit:${row.credit_code ?? ''}`, enterpriseId);
      enterpriseCache.set(`name:${name}`, enterpriseId);
    }

    // Dedup: same enterprise + description + location within 30 days.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const dup = await tx.hazards.findFirst({
      where: {
        enterprise_id: enterpriseId,
        description: desc,
        location: row.location ?? null,
        created_at: { gte: cutoff },
      },
    });
    if (dup) return { reason: '重复数据（最近1个月内已存在）' };

    await tx.hazards.create({
      data: {
        enterprise_id: enterpriseId,
        batch_id: batchId,
        content: desc,
        description: desc,
        location: row.location ?? null,
        category: row.category ?? null,
        inspection_method: row.inspection_method ?? null,
        inspector: row.inspector ?? null,
        inspection_date: row.inspection_date ? new Date(row.inspection_date) : null,
        judgment_basis: row.judgment_basis ?? null,
        violation_clause: row.violation_clause ?? null,
        is_rectified: row.is_rectified ?? null,
        rectification_date: row.rectification_date ? new Date(row.rectification_date) : null,
        rectification_responsible: row.rectification_responsible ?? null,
        rectification_measures: row.rectification_measures ?? null,
        report_remarks: row.report_remarks ?? null,
        reporting_unit: row.reporting_unit ?? null,
        status: 'pending',
      },
    });
    return null;
  }

  async errors(batchId: string): Promise<ImportErrorResponseDto[]> {
    const rows = await this.prisma.import_errors.findMany({
      where: { batch_id: batchId },
      orderBy: { row_index: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      batch_id: r.batch_id,
      row_index: r.row_index,
      raw_data: r.raw_data,
      reason: r.reason,
    }));
  }

  async remove(batchId: string, currentUserId?: string): Promise<void> {
    const b = await this.prisma.batches.findFirst({ where: { id: batchId } });
    if (!b) throw new NotFoundException('批次不存在');

    const lockedCount = await this.prisma.hazards.count({
      where: { batch_id: b.id, deleted_at: null, current_task_id: { not: null } },
    });
    if (lockedCount > 0) {
      throw new BadRequestException('该批次中存在正在复核中的隐患，无法删除');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.batches.update({ where: { id: b.id }, data: { deleted_at: now } });
      await tx.hazards.updateMany({
        where: { batch_id: b.id, deleted_at: null },
        data: { deleted_at: now, current_task_id: null },
      });
      await tx.import_errors.deleteMany({
        where: { batch_id: b.id },
      });
    });
  }

  async downloadFile(batchId: string): Promise<{ name: string; contentType: string; data: Buffer }> {
    const b = await this.prisma.batches.findFirst({ where: { id: batchId } });
    if (!b || !b.original_file_path) throw new NotFoundException('文件不存在');
    const data = await this.storage.getObject(b.original_file_path);
    const contentType = b.file_name?.toLowerCase().endsWith('.csv')
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { name: b.file_name ?? 'download.xlsx', contentType, data };
  }

  async exportTemplateBuffer(): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('导入模板');
    const headers = [
      '上报单位', '行业领域', '企业类型', '企业名称', '统一社会信用代码',
      '属地', '详细地址', '负责人', '隐患分类', '隐患描述', '隐患位置',
      '检查方式', '检查人', '检查时间', '判定依据', '违反判定依据具体条款',
      '是否整改', '实际整改完成时间', '整改责任部门/责任人', '整改措施',
      '举报情况备注',
    ];
    ws.addRow(headers);
    ws.addRow([
      '崇贤街道', '商务系统', '个体经营', '示例企业', '91110000123456789X',
      '北京市', '北京市朝阳区示例路1号', '张三', '一般隐患',
      '燃气使用场所安装可燃气体报警装置未启用', '一号车间', '企业自查',
      '李四、王五', '2026-03-16', '《商务领域安全生产重大隐患排查事项清单》',
      '《商务系统安全生产风险隐患事项清单》七、餐饮领域', '已整改',
      '2026-03-23', '崇贤街道/李四', '可燃气体报警器已通电启用', '',
    ]);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
