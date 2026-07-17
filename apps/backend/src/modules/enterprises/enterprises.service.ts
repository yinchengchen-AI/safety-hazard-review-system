import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateEnterpriseDto, EnterpriseImportRequestDto, EnterpriseImportResultDto, EnterpriseListResponseDto, EnterpriseResponseDto, UpdateEnterpriseDto } from './dto/enterprise.dto';

function toResponse(e: {
  id: string;
  name: string;
  credit_code: string | null;
  region: string | null;
  address: string | null;
  contact_person: string | null;
  industry_sector: string | null;
  enterprise_type: string | null;
  created_at: Date | null;
}): EnterpriseResponseDto {
  return {
    id: e.id,
    name: e.name,
    credit_code: e.credit_code,
    region: e.region,
    address: e.address,
    contact_person: e.contact_person,
    industry_sector: e.industry_sector,
    enterprise_type: e.enterprise_type,
    created_at: e.created_at,
  };
}

@Injectable()
export class EnterprisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async create(dto: CreateEnterpriseDto, currentUserId?: string): Promise<EnterpriseResponseDto> {
    const created = await this.prisma.enterprises.create({ data: { ...dto } });
    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'enterprise.create',
      targetType: 'enterprise',
      targetId: created.id,
      detail: { name: created.name, credit_code: created.credit_code },
    });
    return toResponse(created);
  }

  async list(page: number, pageSize: number, keyword: string): Promise<EnterpriseListResponseDto> {
    const kw = keyword.trim();
    const where: Prisma.enterprisesWhereInput = kw
      ? {
          OR: [
            { name: { contains: kw, mode: 'insensitive' } },
            { credit_code: { contains: kw, mode: 'insensitive' } },
            { region: { contains: kw, mode: 'insensitive' } },
            { contact_person: { contains: kw, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.enterprises.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.enterprises.count({ where }),
    ]);
    return { items: items.map(toResponse), total };
  }

  async findOne(id: string): Promise<EnterpriseResponseDto> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');
    return toResponse(e);
  }

  async update(id: string, dto: UpdateEnterpriseDto, currentUserId?: string): Promise<EnterpriseResponseDto> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');
    const updated = await this.prisma.enterprises.update({ where: { id: e.id }, data: { ...dto } });
    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'enterprise.update',
      targetType: 'enterprise',
      targetId: e.id,
      detail: { name: e.name, changed: Object.keys(dto) },
    });
    return toResponse(updated);
  }

  async remove(id: string, currentUserId?: string): Promise<void> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');
    await this.prisma.enterprises.update({
      where: { id: e.id },
      data: { deleted_at: new Date() },
    });
    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'enterprise.delete',
      targetType: 'enterprise',
      targetId: e.id,
      detail: { name: e.name },
    });
  }

  async statistics(id: string): Promise<{
    enterprise_id: string;
    total_hazards: number;
    pending_count: number;
    passed_count: number;
    failed_count: number;
    reviewed_count: number;
    coverage_rate: number;
    pass_rate: number;
  }> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');

    const grouped = await this.prisma.hazards.groupBy({
      by: ['status'],
      where: { enterprise_id: id },
      _count: { _all: true },
    });
    let total = 0;
    let pending = 0;
    let passed = 0;
    let failed = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status === 'pending') pending = n;
      else if (g.status === 'passed') passed = n;
      else if (g.status === 'failed') failed = n;
    }
    const reviewed = passed + failed;
    const coverage = total > 0 ? Math.round((reviewed / total) * 10000) / 100 : 0;
    const pass = reviewed > 0 ? Math.round((passed / reviewed) * 10000) / 100 : 0;
    return {
      enterprise_id: id,
      total_hazards: total,
      pending_count: pending,
      passed_count: passed,
      failed_count: failed,
      reviewed_count: reviewed,
      coverage_rate: coverage,
      pass_rate: pass,
    };
  }

  async importRows(dto: EnterpriseImportRequestDto): Promise<EnterpriseImportResultDto> {
    const errors: string[] = [];
    let success = 0;
    // P2-6: batch the existence checks with a single query per
    // dimension (name + credit_code) instead of N round-trips.
    const names = Array.from(
      new Set(dto.rows.map((r) => r.name?.trim()).filter((n): n is string => !!n)),
    );
    const codes = Array.from(
      new Set(dto.rows.map((r) => r.credit_code).filter((c): c is string => !!c)),
    );
    const existing = await this.prisma.enterprises.findMany({
      where: {
        OR: [
          { name: { in: names } },
          ...(codes.length ? [{ credit_code: { in: codes } }] : []),
        ],
      },
      select: { name: true, credit_code: true },
    });
    const nameSet = new Set(existing.map((e) => e.name));
    const codeSet = new Set(existing.map((e) => e.credit_code).filter((c): c is string => !!c));
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.rows.length; i++) {
        const row = dto.rows[i];
        const rowNum = i + 2;
        const name = row.name?.trim();
        if (!name) {
          errors.push(`第${rowNum}行: 企业名称不能为空`);
          continue;
        }
        if (nameSet.has(name)) {
          errors.push(`第${rowNum}行: 企业名称已存在: ${name}`);
          continue;
        }
        if (row.credit_code && codeSet.has(row.credit_code)) {
          errors.push(`第${rowNum}行: 统一社会信用代码已存在: ${row.credit_code}`);
          continue;
        }
        try {
          await tx.enterprises.create({ data: { ...row, name } });
          // Reserve the names so later rows in the same import collide.
          nameSet.add(name);
          if (row.credit_code) codeSet.add(row.credit_code);
          success += 1;
        } catch (e) {
          errors.push(`第${rowNum}行: ${(e as Error).message}`);
        }
      }
    });
    return { success_count: success, error_count: errors.length, errors };
  }

  /**
   * Stream the enterprise list to an Excel workbook in fixed-size
   * pages so the API never holds more than PAGE_SIZE rows in
   * memory. The caller pipes the returned stream to the HTTP
   * response; ExcelJS flushes each batch through the stream.
   */
  async exportToStream(out: import('stream').Writable): Promise<number> {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('企业列表');
    ws.columns = [
      { header: '企业名称', key: 'name', width: 30 },
      { header: '统一社会信用代码', key: 'credit_code', width: 24 },
      { header: '属地', key: 'region', width: 16 },
      { header: '详细地址', key: 'address', width: 40 },
      { header: '负责人', key: 'contact_person', width: 16 },
      { header: '行业领域', key: 'industry_sector', width: 16 },
      { header: '企业类型', key: 'enterprise_type', width: 16 },
      { header: '创建时间', key: 'created_at', width: 20 },
    ];
    const PAGE_SIZE = 1000;
    let skip = 0;
    let total = 0;
    while (true) {
      const batch = await this.prisma.enterprises.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: PAGE_SIZE,
      });
      if (batch.length === 0) break;
      for (const e of batch) {
        ws.addRow({
          name: e.name,
          credit_code: e.credit_code ?? '',
          region: e.region ?? '',
          address: e.address ?? '',
          contact_person: e.contact_person ?? '',
          industry_sector: e.industry_sector ?? '',
          enterprise_type: e.enterprise_type ?? '',
          created_at: e.created_at ? e.created_at.toISOString().slice(0, 19).replace('T', ' ') : '',
        });
      }
      total += batch.length;
      skip += batch.length;
      if (batch.length < PAGE_SIZE) break;
    }
    await wb.xlsx.write(out);
    // ExcelJS does not always call .end() on the writable; close
    // it explicitly so the HTTP layer can flush the response.
    const maybeEnd = (out as unknown as { end?: () => void }).end;
    if (typeof maybeEnd === 'function' && !out.writableEnded) {
      maybeEnd.call(out);
    }
    return total;
  }

  /** Legacy helper retained for tests that want a Buffer (max 1k rows). */
  async exportToBuffer(): Promise<Buffer> {
    const { Writable } = await import('stream');
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) { chunks.push(chunk); cb(); },
    });
    await this.exportToStream(sink);
    return Buffer.concat(chunks);
  }

  async exportTemplateBuffer(): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('导入模板');
    ws.columns = [
      { header: '企业名称', key: 'name', width: 30 },
      { header: '统一社会信用代码', key: 'credit_code', width: 24 },
      { header: '属地', key: 'region', width: 16 },
      { header: '详细地址', key: 'address', width: 40 },
      { header: '负责人', key: 'contact_person', width: 16 },
      { header: '行业领域', key: 'industry_sector', width: 16 },
      { header: '企业类型', key: 'enterprise_type', width: 16 },
    ];
    ws.addRow({
      name: '示例企业',
      credit_code: '91110000123456789X',
      region: '北京市',
      address: '北京市朝阳区示例路1号',
      contact_person: '张三',
      industry_sector: '商务系统',
      enterprise_type: '个体经营',
    });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
