import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditContextStore } from '../../common/audit-context';

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

  constructor(
    private readonly prisma: PrismaService,
    @InjectMetric('audit_write_failures_total')
    private readonly failureCounter: Counter<string>,
  ) {}

  /**
   * Persist a single audit row. ``requestInfo`` is optional; when
   * omitted, the current AsyncLocalStorage scope (set up by the
   * ``AuditContextInterceptor``) is used so the row carries the
   * IP / method / path / user-agent of the originating request
   * even when called from a deeply nested service.
   *
   * Errors are swallowed and logged: audit must never break the
   * user-facing flow.
   */
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
      const ctx = AuditContextStore.get();
      const ip = input.requestInfo?.ip ?? ctx?.ipAddress ?? null;
      const ua = input.requestInfo?.userAgent ?? ctx?.userAgent ?? null;
      const method = input.requestInfo?.method ?? ctx?.method ?? null;
      const path = input.requestInfo?.path ?? ctx?.path ?? null;
      const statusCode = input.requestInfo?.statusCode ?? ctx?.statusCode ?? null;
      await this.prisma.audit_logs.create({
        data: {
          user_id: input.userId ?? null,
          action: input.action,
          target_type: input.targetType,
          target_id: input.targetId ?? null,
          detail: (sanitize(input.detail ?? null) as never) ?? undefined,
          ip_address: ip,
          method,
          path,
          status_code: statusCode,
          user_agent: ua,
        },
      });
    } catch (err) {
      // P1-7: audit failures used to be silently swallowed. We now
      // log at error level AND bump a Prometheus counter so SRE
      // dashboards can alert on persistent audit-write failures.
      this.logger.error(`audit log write failed: ${(err as Error).message}`);
      try {
        this.failureCounter.inc({ kind: 'audit' });
      } catch {
        // metric may not be registered in tests; ignore
      }
    }
  }

  async findById(id: string) {
    return this.prisma.audit_logs.findFirst({ where: { id } });
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
