import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EDITABLE_FIELDS,
  HazardEditableFieldsDto,
  HazardListQueryDto,
  HazardListResponseDto,
  HazardResponseDto,
  UpdateHazardDto,
} from './dto/hazard.dto';

function toResponse(h: any): HazardResponseDto {
  return {
    id: h.id,
    enterprise_id: h.enterprise_id,
    batch_id: h.batch_id,
    content: h.content,
    description: h.description,
    location: h.location,
    category: h.category,
    inspection_method: h.inspection_method,
    inspector: h.inspector,
    inspection_date: h.inspection_date,
    judgment_basis: h.judgment_basis,
    violation_clause: h.violation_clause,
    is_rectified: h.is_rectified,
    rectification_date: h.rectification_date,
    rectification_responsible: h.rectification_responsible,
    rectification_measures: h.rectification_measures,
    report_remarks: h.report_remarks,
    reporting_unit: h.reporting_unit,
    status: h.status,
    current_task_id: h.current_task_id,
    review_count: h.review_count ?? 0,
    created_at: h.created_at,
    updated_at: h.updated_at,
    enterprise_name: h.enterprises?.name ?? null,
    enterprise_credit_code: h.enterprises?.credit_code ?? null,
    enterprise_region: h.enterprises?.region ?? null,
    enterprise_address: h.enterprises?.address ?? null,
    enterprise_contact_person: h.enterprises?.contact_person ?? null,
    enterprise_industry_sector: h.enterprises?.industry_sector ?? null,
    enterprise_enterprise_type: h.enterprises?.enterprise_type ?? null,
    batch_name: h.batches?.name ?? null,
    batch_reporting_unit: h.batches?.reporting_unit ?? null,
  };
}

@Injectable()
export class HazardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: HazardListQueryDto): Promise<HazardListResponseDto> {
    const page = q.page ?? 1;
    const pageSize = q.page_size ?? 20;
    const where: Prisma.hazardsWhereInput = {};
    if (q.enterprise_id) where.enterprise_id = q.enterprise_id;
    if (q.batch_id) where.batch_id = q.batch_id;
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    if (q.inspection_method) where.inspection_method = q.inspection_method;

    const [items, total] = await Promise.all([
      this.prisma.hazards.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { enterprises: true, batches: true },
      }),
      this.prisma.hazards.count({ where }),
    ]);
    return {
      items: items.map(toResponse),
      total,
      page,
      page_size: pageSize,
    };
  }

  async findOne(id: string): Promise<HazardResponseDto> {
    const h = await this.prisma.hazards.findFirst({
      where: { id },
      include: { enterprises: true, batches: true },
    });
    if (!h) throw new NotFoundException('Hazard not found');
    return toResponse(h);
  }

  async editableFields(id: string): Promise<HazardEditableFieldsDto> {
    const h = await this.prisma.hazards.findFirst({ where: { id } });
    if (!h) throw new NotFoundException('Hazard not found');
    const out: Partial<HazardEditableFieldsDto> = {};
    for (const f of EDITABLE_FIELDS) {
      (out as Record<string, boolean>)[f] = (h as Record<string, unknown>)[f] === null
        || (h as Record<string, unknown>)[f] === undefined;
    }
    return out as HazardEditableFieldsDto;
  }

  async update(id: string, dto: UpdateHazardDto): Promise<HazardResponseDto> {
    const h = await this.prisma.hazards.findFirst({ where: { id } });
    if (!h) throw new NotFoundException('Hazard not found');

    // Reject updates to fields that are already set (only-NULL fields are
    // editable, mirroring the Python backend's behaviour).
    for (const [field, newValue] of Object.entries(dto)) {
      if (newValue === undefined) continue;
      const current = (h as Record<string, unknown>)[field];
      if (current !== null && current !== undefined) {
        throw new BadRequestException(`字段 '${field}' 已有值，不可修改`);
      }
    }
    return toResponse(
      await this.prisma.hazards.update({
        where: { id: h.id },
        data: dto,
        include: { enterprises: true, batches: true },
      }),
    );
  }
}
