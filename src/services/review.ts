import { prisma } from '@/lib/prisma';
import { BusinessError } from '@/lib/errors';
import { CaseService } from './case';
import type { Review, ItemResult, Conclusion } from '@prisma/client';

const ACTIVE_GRACE_MS = 24 * 3600 * 1000;

export const ReviewService = {
  /**
   * 监管员开始复核：FOR UPDATE 锁定 Review 行 + 写入 claimedById/claimedAt/lastActiveAt
   */
  async claim(caseId: string, userId: string): Promise<Review> {
    return prisma.$transaction(async (tx) => {
      const r = await tx.$queryRaw<Review[]>`
        SELECT * FROM "Review" WHERE "caseId" = ${caseId} AND status = 'IN_PROGRESS' ORDER BY "startedAt" DESC LIMIT 1 FOR UPDATE
      `;
      const review = r[0];
      if (!review) throw new BusinessError('no_active_review', 'No in-progress review for this case', 404);
      if (review.claimedById && review.claimedById !== userId) {
        throw new BusinessError('already_claimed', `Already claimed by ${review.claimedById}`, 409);
      }
      const updated = await tx.review.update({
        where: { id: review.id },
        data: { claimedById: userId, claimedAt: new Date(), lastActiveAt: new Date() },
      });
      await tx.auditLog.create({
        data: { userId, action: 'review:claim', targetType: 'Review', targetId: review.id },
      });
      return updated;
    });
  },

  /**
   * 接管：原 claimedById 长期不活动（>24h）时可强制接管，保留草稿
   */
  async takeOver(caseId: string, userId: string): Promise<Review> {
    return prisma.$transaction(async (tx) => {
      const r = await tx.$queryRaw<Review[]>`
        SELECT * FROM "Review" WHERE "caseId" = ${caseId} AND status = 'IN_PROGRESS' ORDER BY "startedAt" DESC LIMIT 1 FOR UPDATE
      `;
      const review = r[0];
      if (!review) throw new BusinessError('no_active_review', 'No in-progress review for this case', 404);
      if (review.claimedById === userId) {
        throw new BusinessError('already_claimed_by_you', 'You already claimed this review', 409);
      }
      const idleMs = Date.now() - new Date(review.lastActiveAt).getTime();
      if (idleMs < ACTIVE_GRACE_MS) {
        throw new BusinessError('review_active', 'Review is still active, takeover not allowed', 409);
      }
      const updated = await tx.review.update({
        where: { id: review.id },
        data: { claimedById: userId, claimedAt: new Date(), lastActiveAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'review:takeover',
          targetType: 'Review',
          targetId: review.id,
          payload: { previousClaimant: review.claimedById },
        },
      });
      return updated;
    });
  },

  /**
   * 保存单项结果：更新 lastActiveAt
   */
  async saveItem(
    reviewId: string,
    itemId: string,
    result: ItemResult,
    note: string | undefined,
    _userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id: reviewId },
        data: {
          lastActiveAt: new Date(),
          items: {
            upsert: {
              where: { reviewId_itemId: { reviewId, itemId } },
              create: { reviewId, itemId, result, note },
              update: { result, note },
            },
          },
        },
      });
      return r;
    });
  },

  /**
   * 提交 Review + Case 状态 → 待审核
   */
  async submit(caseId: string, conclusion: Conclusion, summary: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const r = await tx.review.findFirst({
        where: { caseId, status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' },
      });
      if (!r) throw new BusinessError('no_active_review', 'No in-progress review', 404);
      if (r.claimedById !== userId) {
        throw new BusinessError('not_claimed_by_you', 'Only the claimer can submit', 403);
      }
      await tx.review.update({
        where: { id: r.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), conclusion, summary },
      });
      await CaseService.transitionStatus(caseId, 'submit_review', userId);
      await tx.auditLog.create({
        data: {
          userId,
          action: 'review:submit',
          targetType: 'Review',
          targetId: r.id,
          payload: { conclusion },
        },
      });
      return r;
    });
  },
};
