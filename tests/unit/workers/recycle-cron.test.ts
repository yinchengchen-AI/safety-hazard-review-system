import { describe, it, expect, beforeEach, vi } from 'vitest';

const transitionStatusSpy = vi.fn();

vi.mock('@/services/case', () => ({
  CaseService: { transitionStatus: (...args: unknown[]) => transitionStatusSpy(...args) },
}));

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

  it('releases idle case audit locks by routing through the state machine', async () => {
    m.review.findMany.mockResolvedValueOnce([]);
    m.case.findMany.mockResolvedValueOnce([
      { id: 'c1', status: 'IN_AUDIT', lockedById: 'u2' },
    ]);
    transitionStatusSpy.mockResolvedValueOnce({});

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    // The direct prisma write is gone — the worker now goes through
    // CaseService.transitionStatus so the audit row uses the same payload
    // shape as every other case transition.
    expect(transitionStatusSpy).toHaveBeenCalledWith('c1', 'reclaim_idle', 'u2');
    expect(m.case.update).not.toHaveBeenCalled();
  });

  it('skips case-level reclaim when the lock has no claimer (no audit needed)', async () => {
    m.review.findMany.mockResolvedValueOnce([]);
    m.case.findMany.mockResolvedValueOnce([{ id: 'c1', status: 'IN_AUDIT', lockedById: null }]);

    const { scanRecycle } = await import('@/workers/recycle-cron');
    await scanRecycle();

    expect(transitionStatusSpy).not.toHaveBeenCalled();
    expect(m.case.update).not.toHaveBeenCalled();
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
