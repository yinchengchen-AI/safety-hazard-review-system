import { prisma } from '@/lib/prisma';
import { BusinessError } from '@/lib/errors';
import { transitionCase, type CaseEvent } from './state-machine';
import { generateCaseCode } from './code-generator';
import type { Case, CaseStatus, CaseSeverity, Prisma } from '@prisma/client';

export type RegisterInput = {
  enterpriseId: string;
  hazardTypeId: string;
  severity: CaseSeverity;
  source: string;
  description: string;
  address?: string;
  gpsLat?: number;
  gpsLng?: number;
  deadline: Date;
  templateId: string;
  reviewerId: string;
};

export const CaseService = {
  async register(input: RegisterInput, actorId: string): Promise<Case> {
    return prisma.$transaction(async (tx) => {
      const code = await generateCaseCode(tx);
      const c = await tx.case.create({
        data: {
          code,
          enterpriseId: input.enterpriseId,
          hazardTypeId: input.hazardTypeId,
          severity: input.severity,
          source: input.source,
          description: input.description,
          address: input.address,
          gpsLat: input.gpsLat,
          gpsLng: input.gpsLng,
          deadline: input.deadline,
          status: 'PENDING_REVIEW',
          registeredById: actorId,
        },
      });
      await tx.review.create({
        data: {
          caseId: c.id,
          reviewerId: input.reviewerId,
          templateId: input.templateId,
          status: 'IN_PROGRESS',
        },
      });
      await tx.auditLog.create({
        data: { userId: actorId, action: 'register', targetType: 'Case', targetId: c.id },
      });
      return c;
    });
  },

  async getById(id: string): Promise<Case | null> {
    return prisma.case.findUnique({ where: { id } });
  },

  async list(filter: {
    status?: CaseStatus;
    hazardTypeId?: string;
    enterpriseId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CaseWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.hazardTypeId) where.hazardTypeId = filter.hazardTypeId;
    if (filter.enterpriseId) where.enterpriseId = filter.enterpriseId;
    const [items, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        include: {
          enterprise: true,
          hazardType: true,
          registeredBy: { select: { name: true } },
        },
      }),
      prisma.case.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  },

  /**
   * 通用状态转移 — 调用 state machine + 事务更新
   */
  async transitionStatus(
    caseId: string,
    event: CaseEvent,
    actorId: string,
    extra: Record<string, unknown> = {},
  ): Promise<Case> {
    return prisma.$transaction(async (tx) => {
      const c = await tx.case.findUnique({ where: { id: caseId } });
      if (!c) throw new BusinessError('not_found', 'Case not found', 404);
      const next = transitionCase(c.status, event, actorId);
      const updated = await tx.case.update({
        where: { id: caseId },
        data: {
          status: next,
          ...(event === 'open_audit' && { lockedById: actorId, lockedAt: new Date() }),
          ...(event === 'sign' && { closedAt: new Date(), lockedById: null, lockedAt: null }),
          ...(event === 'reject' && { lockedById: null, lockedAt: null }),
          ...(event === 'reclaim_idle' && { lockedById: null, lockedAt: null }),
          ...extra,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: `case:${event}`,
          targetType: 'Case',
          targetId: caseId,
          payload: { from: c.status, to: next },
        },
      });
      return updated;
    });
  },
};
