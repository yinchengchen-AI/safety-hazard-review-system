import { prisma } from '@/lib/prisma';
import { BusinessError } from '@/lib/errors';
import { CaseService } from './case';

export const AuditService = {
  /**
   * 科长点开案件：FOR UPDATE 锁定 → status = IN_AUDIT
   * 已被他人锁定则抛错（让前端切只读模式）
   */
  async openAudit(caseId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.$queryRaw<{ id: string; status: string; lockedById: string | null }[]>`
        SELECT id, status, "lockedById" FROM "Case" WHERE id = ${caseId} FOR UPDATE
      `;
      const row = c[0];
      if (!row) throw new BusinessError('not_found', 'Case not found', 404);
      if (row.status !== 'PENDING_AUDIT') {
        throw new BusinessError('invalid_state', `Case is ${row.status}, cannot open audit`, 409);
      }
      if (row.lockedById && row.lockedById !== userId) {
        throw new BusinessError('locked_by_other', `Already locked by ${row.lockedById}`, 409);
      }
      return CaseService.transitionStatus(caseId, 'open_audit', userId);
    });
  },

  /**
   * 通过 + 签名
   */
  async sign(caseId: string, userId: string, signatureUrl: string, comment: string | undefined) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.case.findUnique({ where: { id: caseId } });
      if (!c) throw new BusinessError('not_found', 'Case not found', 404);
      if (c.status !== 'IN_AUDIT' || c.lockedById !== userId) {
        throw new BusinessError('not_locked_by_you', 'You must open the audit first', 403);
      }
      await tx.auditSignature.create({
        data: { caseId, auditorId: userId, decision: 'PASS', signatureUrl, comment },
      });
      await CaseService.transitionStatus(caseId, 'sign', userId);
      await tx.auditLog.create({
        data: {
          userId,
          action: 'audit:sign',
          targetType: 'Case',
          targetId: caseId,
          payload: { comment },
        },
      });
      return c;
    });
  },

  /**
   * 驳回：当前 Review.status=returned，新建空 Review 等下一轮
   */
  async reject(caseId: string, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.case.findUnique({ where: { id: caseId } });
      if (!c) throw new BusinessError('not_found', 'Case not found', 404);
      if (c.status !== 'IN_AUDIT' || c.lockedById !== userId) {
        throw new BusinessError('not_locked_by_you', 'You must open the audit first', 403);
      }
      const currentReview = await tx.review.findFirst({
        where: { caseId, status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
      });
      if (currentReview) {
        await tx.review.update({
          where: { id: currentReview.id },
          data: { status: 'RETURNED' },
        });
        await tx.review.create({
          data: {
            caseId,
            reviewerId: currentReview.reviewerId,
            templateId: currentReview.templateId,
            status: 'IN_PROGRESS',
          },
        });
      }
      await tx.auditSignature.create({
        data: { caseId, auditorId: userId, decision: 'REJECT', comment: reason, signatureUrl: '' },
      });
      await CaseService.transitionStatus(caseId, 'reject', userId);
      await tx.auditLog.create({
        data: {
          userId,
          action: 'audit:reject',
          targetType: 'Case',
          targetId: caseId,
          payload: { reason },
        },
      });
      return c;
    });
  },
};
