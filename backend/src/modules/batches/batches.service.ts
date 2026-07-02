import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BatchImportRequestDto,
  BatchImportResultDto,
  BatchPreviewItemDto,
  BatchPreviewRequestDto,
  BatchPreviewResponseDto,
  BatchResponseDto,
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

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async import(dto: BatchImportRequestDto, userId: string): Promise<BatchImportResultDto> {
      const batch = await this.prisma.batches.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        file_name: dto.filename,
        total_count: dto.rows.length,
        success_count: 0,
        fail_count: 0,
        creator_id: userId,
      },
    });

    const errors: { row_index: number; reason: string }[] = [];
    let success = 0;

    for (let i = 0; i < dto.rows.length; i++) {
      const rowNum = i + 2;
      const row = dto.rows[i];
      const result = await this._processRow(batch.id, row);
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
      data: { success_count: success, fail_count: errors.length },
    });

    return {
      batch: toBatchResponse(updated, 0, null),
      success_count: success,
      fail_count: errors.length,
      errors,
    };
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
  ): Promise<{ reason?: string }> {
    const savepoint = await this.prisma.$transaction(async (tx) => {
      return await this._processRowInner(tx, batchId, row);
    });
    return savepoint ?? {};
  }

  private async _processRowInner(
    tx: Prisma.TransactionClient,
    batchId: string,
    row: import('./dto/batch.dto').HazardImportRow,
  ): Promise<{ reason?: string } | null> {
    if (!row.enterprise_name) return { reason: '企业名称不能为空' };
    if (!row.description) return { reason: '隐患描述不能为空' };

    // Find or create enterprise.
    const enterprise = await tx.enterprises.findFirst({ where: { name: row.enterprise_name } });
    let enterpriseId: string;
    if (!enterprise) {
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
    } else {
      enterpriseId = enterprise.id;
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
    const now = new Date();
    await this.prisma.batches.update({ where: { id: b.id }, data: { deleted_at: now } });
    await this.prisma.hazards.updateMany({
      where: { batch_id: b.id, deleted_at: null },
      data: { deleted_at: now },
    });
    await this.prisma.import_errors.deleteMany({
      where: { batch_id: b.id },
    });
  }

  async downloadFile(batchId: string): Promise<{ name: string; contentType: string; data: Buffer }> {
    const b = await this.prisma.batches.findFirst({ where: { id: batchId } });
    if (!b || !b.original_file_path) throw new NotFoundException('文件不存在');
    // For the legacy Python backend the file is in MinIO. Phase 2 ships
    // the JSON-based import; the original-file download endpoint is a
    // placeholder until the binary upload pipeline lands in Phase 3.
    throw new NotFoundException('original file download not available in Phase 2; use the JSON import path');
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
