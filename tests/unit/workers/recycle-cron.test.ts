import { describe, it, expect, beforeEach, vi } from 'vitest';

type PrismaMock = ReturnType<typeof buildPrismaMock>;

function buildPrismaMock() {
  const reviewFindMany = vi.fn();
  const reviewUpdate = vi.fn();
  const caseFindMany = vi.fn();
  const caseUpdate = vi.fn();
  const auditLogCreate = vi.fn();
  const notificationCreate = vi.fn();

  return {
    review: { findMany: reviewFindMany, update: reviewUpdate },
    case: { findMany: caseFindMany, update: caseUpdate },
    auditLog: { create: auditLogCreate },
    notification: { create: notificationCreate },
  };
}

describe('recycle-cron.scanRecycle', () => {
  let m: PrismaMock;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m = buildPrismaMock();
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));
  });

  it('releases idle review claims and notifies the original claimer', async () => {
    const idleReview = {
      id: 'r1',
      caseId: 'c1',
      claimedById: 'u1',
      status: 'IN_PROGRESS',
    };
    m.review.findMany.mockResolvedValueOnce([idleReview]);
    m.case.findMany.mockResolvedValueOnce([]);

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    expect(m.review.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { claimedById: null, claimedAt: null },
    });
    expect(m.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        action: 'review:reclaim_idle',
        targetType: 'Review',
        targetId: 'r1',
      },
    });
    expect(m.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'RECLAIM_NOTICE',
      }),
    });
  });

  it('releases idle case audit locks and rolls status back to PENDING_AUDIT', async () => {
    m.review.findMany.mockResolvedValueOnce([]);
    m.case.findMany.mockResolvedValueOnce([
      { id: 'c1', status: 'IN_AUDIT', lockedById: 'u2' },
    ]);

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    expect(m.case.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lockedById: null, lockedAt: null, status: 'PENDING_AUDIT' },
    });
    expect(m.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'u2',
        action: 'case:reclaim_idle',
        targetType: 'Case',
        targetId: 'c1',
      },
    });
  });

  it('does nothing when no stale rows exist', async () => {
    m.review.findMany.mockResolvedValueOnce([]);
    m.case.findMany.mockResolvedValueOnce([]);

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    expect(m.review.update).not.toHaveBeenCalled();
    expect(m.case.update).not.toHaveBeenCalled();
    expect(m.auditLog.create).not.toHaveBeenCalled();
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it('skips notification + audit if the idle review had no claimer', async () => {
    m.review.findMany.mockResolvedValueOnce([
      { id: 'r1', caseId: 'c1', claimedById: null, status: 'IN_PROGRESS' },
    ]);
    m.case.findMany.mockResolvedValueOnce([]);

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    expect(m.review.update).toHaveBeenCalled();
    expect(m.auditLog.create).not.toHaveBeenCalled();
    expect(m.notification.create).not.toHaveBeenCalled();
  });
});
