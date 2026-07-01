import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard, AdminGuard } from '../../common/guards';

class AuditLogQueryDto {
  @IsOptional() @IsUUID() user_id?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() target_type?: string;
  @IsOptional() @IsUUID() target_id?: string;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) page_size: number = 20;
}

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard, ActiveUserGuard, AdminGuard)
export class AuditLogsController {
  constructor(private readonly audit: AuditLogsService) {}

  @Get()
  list(@Query() q: AuditLogQueryDto) {
    return this.audit.list({
      userId: q.user_id,
      action: q.action,
      targetType: q.target_type,
      targetId: q.target_id,
      startDate: q.start_date ? new Date(q.start_date) : undefined,
      endDate: q.end_date ? new Date(q.end_date) : undefined,
      page: q.page,
      pageSize: q.page_size,
    });
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.audit.list({ page: 1, pageSize: 1 }).then(async (res) => {
      // The list query filters; we just want one by id.
      const all = await this.audit['prisma'].audit_logs.findFirst({ where: { id } });
      if (!all) return { detail: 'Audit log not found', status_code: 404 };
      return all;
    });
  }
}
