import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnterpriseDto): Promise<EnterpriseResponseDto> {
    return toResponse(
      await this.prisma.enterprises.create({ data: { ...dto } }),
    );
  }

  async list(page: number, pageSize: number, keyword: string): Promise<EnterpriseListResponseDto> {
    const where: Prisma.enterprisesWhereInput = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { credit_code: { contains: keyword, mode: 'insensitive' } },
            { region: { contains: keyword, mode: 'insensitive' } },
            { contact_person: { contains: keyword, mode: 'insensitive' } },
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

  async update(id: string, dto: UpdateEnterpriseDto): Promise<EnterpriseResponseDto> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');
    return toResponse(
      await this.prisma.enterprises.update({ where: { id: e.id }, data: { ...dto } }),
    );
  }

  async remove(id: string): Promise<void> {
    const e = await this.prisma.enterprises.findFirst({ where: { id } });
    if (!e) throw new NotFoundException('Enterprise not found');
    await this.prisma.enterprises.update({
      where: { id: e.id },
      data: { deleted_at: new Date() },
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
    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];
      const rowNum = i + 2;
      try {
        if (!row.name) throw new Error('企业名称不能为空');
        const dup = await this.prisma.enterprises.findFirst({ where: { name: row.name } });
        if (dup) throw new Error(`企业名称已存在: ${row.name}`);
        if (row.credit_code) {
          const dupCode = await this.prisma.enterprises.findFirst({
            where: { credit_code: row.credit_code },
          });
          if (dupCode) throw new Error(`统一社会信用代码已存在: ${row.credit_code}`);
        }
        await this.prisma.enterprises.create({ data: { ...row } });
        success += 1;
      } catch (e) {
        errors.push(`第${rowNum}行: ${(e as Error).message}`);
      }
    }
    return { success_count: success, error_count: errors.length, errors };
  }

  /** Excel export — produces an .xlsx using exceljs. The front-end
   *  also has its own download helper; this endpoint lets server-side
   *  scripts and curl-based audits pull the same data. */
  async exportToBuffer(): Promise<Buffer> {
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
    const all = await this.prisma.enterprises.findMany({ orderBy: { created_at: 'desc' } });
    for (const e of all) {
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
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  /** Excel template used by the front-end to give users a starting
   *  point. */
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
