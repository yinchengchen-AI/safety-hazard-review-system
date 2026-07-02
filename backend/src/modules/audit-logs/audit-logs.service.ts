import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SENSITIVE = new Set([
  'password', 'token', 'access_token', 'temp_token', 'api_key', 'secret',
  'authorization', 'password_hash', 'new_password', 'private_key',
  'session_id', 'cookie', 'csrf_token',
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE.has(k.toLowerCase())) out[k] = '[REDACTED]';
    else out[k] = sanitize(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    detail?: Record<string, unknown> | null;
    requestInfo?: {
      ip?: string;
      userAgent?: string;
      method?: string;
      path?: string;
      statusCode?: number;
    } | null;
  }): Promise<void> {
    try {
      await this.prisma.audit_logs.create({
        data: {
          user_id: input.userId ?? null,
          action: input.action,
          target_type: input.targetType,
          target_id: input.targetId ?? null,
          detail: (sanitize(input.detail ?? null) as never) ?? undefined,
          ip_address: input.requestInfo?.ip ?? null,
          method: input.requestInfo?.method ?? null,
          path: input.requestInfo?.path ?? null,
          status_code: input.requestInfo?.statusCode ?? null,
          user_agent: input.requestInfo?.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log write failed: ${(err as Error).message}`);
    }
  }

  async list(filters: {
    userId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.audit_logsWhereInput = {};
    if (filters.userId) where['user_id'] = filters.userId;
    if (filters.action) where['action'] = { contains: filters.action, mode: 'insensitive' };
    if (filters.targetType) where['target_type'] = filters.targetType;
    if (filters.targetId) where['target_id'] = filters.targetId;
    if (filters.startDate || filters.endDate) {
      where['created_at'] = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);
    return { items, total };
  }
}
