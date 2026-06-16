import { prisma } from '@/lib/prisma';

const IDLE_MS = 24 * 3600 * 1000;

export async function scanRecycle() {
  const threshold = new Date(Date.now() - IDLE_MS);

  // 释放长期不活动的 Review claim
  const stale = await prisma.review.findMany({
    where: {
      status: 'IN_PROGRESS',
      lastActiveAt: { lt: threshold },
      claimedById: { not: null },
    },
  });
  for (const r of stale) {
    await prisma.review.update({
      where: { id: r.id },
      data: { claimedById: null, claimedAt: null },
    });
    if (r.claimedById) {
      await prisma.auditLog.create({
        data: {
          userId: r.claimedById,
          action: 'review:reclaim_idle',
          targetType: 'Review',
          targetId: r.id,
        },
      });
      await prisma.notification.create({
        data: {
          userId: r.claimedById,
          type: 'RECLAIM_NOTICE',
          title: '复核草稿已释放',
          body: `因 24h 未活动，您在案件 ${r.caseId} 的复核草稿已被释放，其他监管员可以接管。`,
        },
      });
    }
  }

  // 释放长期未签字的 Case 锁
  const staleLocks = await prisma.case.findMany({
    where: { status: 'IN_AUDIT', lockedAt: { lt: threshold } },
  });
  for (const c of staleLocks) {
    await prisma.case.update({
      where: { id: c.id },
      data: { lockedById: null, lockedAt: null, status: 'PENDING_AUDIT' },
    });
    if (c.lockedById) {
      await prisma.auditLog.create({
        data: {
          userId: c.lockedById,
          action: 'case:reclaim_idle',
          targetType: 'Case',
          targetId: c.id,
        },
      });
    }
  }
}
