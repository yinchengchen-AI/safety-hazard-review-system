import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BatchImportResultDto,
  BatchPreviewItemDto,
  BatchPreviewRequestDto,
  BatchPreviewResponseDto,
  BatchResponseDto,
  HazardImportRow,
  ImportErrorResponseDto,
} from './dto/batch.dto';

// BatchJoined = batches row + users join (creator).
type BatchJoined = any
function toBatchResponse(b: BatchJoined, availableHazardCount = 0, creatorUsername: string | null = null): BatchResponseDto {
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

// Map a worksheet row object (keys from header row) to HazardImportRow.
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

// Minimal CSV line parser that handles quoted fields.
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

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(page: number, pageSize: number): Promise<BatchResponseDto[]> {
    const rows = await this.prisma.batches.findMany({
      where: {},
      orderBy: { import_time: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { users: true },
    });
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.prisma.hazards.groupBy({
      by: ['batch_id'],
      where: { batch_id: { in: ids }, current_task_id: null },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.batch_id, c._count._all]));
    return rows.map((r) =>
      toBatchResponse(r, countMap.get(r.id) ?? 0, r.users?.username ?? null),
    );
  }

  async preview(dto: BatchPreviewRequestDto): Promise<BatchPreviewResponseDto> {
    const items: BatchPreviewItemDto[] = dto.rows.map((row, i) => {
      const errors: string[] = [];
      if (!row.enterprise_name) errors.push('企业名称不能为空');
      if (!row.description) errors.push('隐患描述不能为空');
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
    const name = filename.replace(/\.[^.]+$/, '') || `import_${new Date().toISOString().slice(0, 10)}`;

    const batch = await this.prisma.batches.create({
      data: {
        id: randomUUID(),
        name,
        file_name: filename,
        total_count: rows.length,
        success_count: 0,
        fail_count: 0,
        creator_id: userId,
      },
    });

    // Persist the original file so it can be re-downloaded from the
    // batch history page.
    const originalKey = `batches/${batch.id}/original/${filename}`;
    const contentType = filename.toLowerCase().endsWith('.csv')
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    await this.storage.putObject(originalKey, buffer, contentType);

    const errors: { row_index: number; reason: string }[] = [];
    let success = 0;
    // Batch-scoped enterprise cache: same enterprise within one import
    // should yield a single enterprise record. The cache is shared across
    // row SAVEPOINTs because each savepoint commits into the same database
    // transaction scope.
    const enterpriseCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const result = await this._processRow(batch.id, row, enterpriseCache);
      if (result.reason) {
        errors.push({ row_index: rowNum, reason: result.reason });
        await this.prisma.import_errors.create({
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

    const updated = await this.prisma.batches.update({
      where: { id: batch.id },
      data: { success_count: success, fail_count: errors.length, original_file_path: originalKey },
    });

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
      // Minimal CSV parser: split lines, first line is header.
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(',').map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));
      return lines.slice(1).map((line) => this.mapRow(parseCsvLine(line), headers));
    }

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Excel 文件没有工作表');

    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = normalizeHeader(String(cell.value ?? ''));
    });

    const rows: HazardImportRow[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: (string | number | Date | null)[] = [];
      for (let i = 0; i < headers.length; i++) {
        const cell = row.getCell(i + 1);
        values[i] = cell.value as string | number | Date | null;
      }
      rows.push(this.mapRow(values, headers));
    });
    return rows;
  }

  private mapRow(values: (string | number | Date | null)[], headers: string[]): HazardImportRow {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = HEADER_MAP[headers[i]];
      if (!key) continue;
      const raw = values[i];
      if (raw === null || raw === undefined) continue;
      if (raw instanceof Date) {
        row[key] = raw.toISOString().slice(0, 10);
      } else {
        row[key] = String(raw).trim();
      }
    }
    return row as unknown as HazardImportRow;
  }

  /**
   * Process a single import row inside a SAVEPOINT so a single bad
   * row never poisons the outer transaction. Returns ``{ reason }``
   * on handled business error (empty enterprise name, duplicate
   * within 30 days, etc.), or ``null`` on success.
   */
  private async _processRow(
    batchId: string,
    row: import('./dto/batch.dto').HazardImportRow,
    enterpriseCache: Map<string, string>,
  ): Promise<{ reason?: string }> {
    const savepoint = await this.prisma.$transaction(async (tx) => {
      return await this._processRowInner(tx, batchId, row, enterpriseCache);
    });
    return savepoint ?? {};
  }

  private async _processRowInner(
    tx: Prisma.TransactionClient,
    batchId: string,
    row: import('./dto/batch.dto').HazardImportRow,
    enterpriseCache: Map<string, string>,
  ): Promise<{ reason?: string } | null> {
    if (!row.enterprise_name) return { reason: '企业名称不能为空' };
    if (!row.description) return { reason: '隐患描述不能为空' };

    // Find or create enterprise, preferring credit_code match when available.
    const cacheKey = row.credit_code
      ? `credit:${row.credit_code}`
      : `name:${row.enterprise_name}`;
    let enterpriseId = enterpriseCache.get(cacheKey);
    if (!enterpriseId) {
      const enterprise = row.credit_code
        ? await tx.enterprises.findFirst({ where: { credit_code: row.credit_code } })
        : await tx.enterprises.findFirst({ where: { name: row.enterprise_name } });
      if (enterprise) {
        enterpriseId = enterprise.id;
      } else {
        const created = await tx.enterprises.create({
          data: {
            name: row.enterprise_name,
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
      enterpriseCache.set(cacheKey, enterpriseId);
      // Also index by name so subsequent rows without credit_code hit the cache.
      enterpriseCache.set(`name:${row.enterprise_name}`, enterpriseId);
    }

    // Dedup: same enterprise + description + location within 30 days.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const dup = await tx.hazards.findFirst({
      where: {
        enterprise_id: enterpriseId,
        description: row.description,
        location: row.location ?? null,
        created_at: { gte: cutoff },
      },
    });
    if (dup) return { reason: '重复数据（最近1个月内已存在）' };

    await tx.hazards.create({
      data: {
        enterprise_id: enterpriseId,
        batch_id: batchId,
        content: row.description,
        description: row.description,
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

  async remove(batchId: string): Promise<void> {
    const b = await this.prisma.batches.findFirst({ where: { id: batchId } });
    if (!b) throw new NotFoundException('批次不存在');

    // Prevent deletion if any hazard in this batch is currently locked in a
    // pending review task. Completed/cancelled tasks already release the lock.
    const lockedCount = await this.prisma.hazards.count({
      where: { batch_id: b.id, deleted_at: null, current_task_id: { not: null } },
    });
    if (lockedCount > 0) {
      throw new BadRequestException('该批次中存在正在复核中的隐患，无法删除');
    }

    const now = new Date();
    await this.prisma.batches.update({ where: { id: b.id }, data: { deleted_at: now } });
    await this.prisma.hazards.updateMany({
      where: { batch_id: b.id, deleted_at: null },
      data: { deleted_at: now, current_task_id: null },
    });
    await this.prisma.import_errors.deleteMany({
      where: { batch_id: b.id },
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
