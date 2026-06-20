import { describe, it, expect, beforeEach, vi } from 'vitest';

const broadcastSpy = vi.fn();
const transitionStatusSpy = vi.fn();

vi.mock('@/services/notification', () => ({
  NotificationService: { broadcastToChiefs: broadcastSpy },
}));
vi.mock('@/services/case', () => ({
  CaseService: { transitionStatus: transitionStatusSpy },
}));

function buildMocks(opts: {
  reviewLastActiveMs: number;
  reviewClaimedById: string | null;
  status?: string;
}) {
  const reviewRow = {
    id: 'r1',
    caseId: 'c1',
    reviewerId: 'u-inspector',
    templateId: 't1',
    claimedById: opts.reviewClaimedById,
    lastActiveAt: new Date(Date.now() - opts.reviewLastActiveMs),
    status: (opts.status as 'IN_PROGRESS') ?? 'IN_PROGRESS',
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([reviewRow]),
    review: {
      update: vi
        .fn()
        .mockResolvedValue({ ...reviewRow, claimedById: 'u2', lastActiveAt: new Date() }),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    case: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  return { tx, transaction, reviewRow };
}

function mockPrisma(m: { transaction: ReturnType<typeof vi.fn> }) {
  vi.doMock('@/lib/prisma', () => ({
    prisma: { $transaction: m.transaction, case: { update: vi.fn() } },
  }));
}

describe('ReviewService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('takeOver allows takeover when lastActiveAt > 24h ago', async () => {
    const m = buildMocks({ reviewLastActiveMs: 25 * 3600 * 1000, reviewClaimedById: 'u1' });
    mockPrisma(m);
    const { ReviewService } = await import('@/services/review');
    const r = await ReviewService.takeOver('c1', 'u2');
    expect(r.claimedById).toBe('u2');
    expect(m.tx.auditLog.create).toHaveBeenCalled();
  });

  it('takeOver rejects takeover within 24h of last activity', async () => {
    const m = buildMocks({ reviewLastActiveMs: 1 * 3600 * 1000, reviewClaimedById: 'u1' });
    mockPrisma(m);
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.takeOver('c1', 'u2')).rejects.toThrow(/active/);
  });

  it('takeOver rejects when already claimed by you', async () => {
    const m = buildMocks({ reviewLastActiveMs: 25 * 3600 * 1000, reviewClaimedById: 'u2' });
    mockPrisma(m);
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.takeOver('c1', 'u2')).rejects.toMatchObject({
      code: 'already_claimed_by_you',
    });
  });

  it('takeOver throws no_active_review when query returns empty', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      review: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({
      prisma: { $transaction: transaction, case: { update: vi.fn() } },
    }));
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.takeOver('c1', 'u2')).rejects.toMatchObject({
      code: 'no_active_review',
    });
  });

  it('claim assigns the user and writes audit log', async () => {
    const m = buildMocks({ reviewLastActiveMs: 0, reviewClaimedById: null });
    mockPrisma(m);
    const { ReviewService } = await import('@/services/review');
    const r = await ReviewService.claim('c1', 'u1');
    expect(r.claimedById).toBe('u2');
    expect(m.tx.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'review:claim', targetType: 'Review', targetId: 'r1' },
    });
  });

  it('claim rejects when already claimed by another', async () => {
    const m = buildMocks({ reviewLastActiveMs: 0, reviewClaimedById: 'someone-else' });
    mockPrisma(m);
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.claim('c1', 'u1')).rejects.toMatchObject({ code: 'already_claimed' });
  });

  it('saveItem updates lastActiveAt and upserts item result', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'r1', lastActiveAt: new Date() });
    const tx = { review: { update } };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
    const { ReviewService } = await import('@/services/review');
    await ReviewService.saveItem('r1', 'item-1', 'PASS', 'all good', 'u1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        lastActiveAt: expect.any(Date),
        items: {
          upsert: {
            where: { reviewId_itemId: { reviewId: 'r1', itemId: 'item-1' } },
            create: { itemId: 'item-1', result: 'PASS', note: 'all good' },
            update: { result: 'PASS', note: 'all good' },
          },
        },
      },
    });
  });

  it('submit transitions case to PENDING_AUDIT and broadcasts to chiefs', async () => {
    const reviewRow = {
      id: 'r1',
      caseId: 'c1',
      reviewerId: 'u-inspector',
      templateId: 't1',
      claimedById: 'u1',
      status: 'IN_PROGRESS',
    };
    const tx = {
      review: {
        findFirst: vi.fn().mockResolvedValueOnce(reviewRow),
        update: vi.fn().mockResolvedValueOnce({ ...reviewRow, status: 'SUBMITTED' }),
      },
      auditLog: { create: vi.fn() },
      reviewPhoto: { createMany: vi.fn().mockResolvedValueOnce({ count: 0 }) },
    };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
    transitionStatusSpy.mockResolvedValueOnce({});
    broadcastSpy.mockResolvedValueOnce({ count: 2 });

    const { ReviewService } = await import('@/services/review');
    await ReviewService.submit('c1', 'PASS', 'done', 'u1');
    expect(tx.review.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'SUBMITTED', conclusion: 'PASS', summary: 'done' }),
    });
    expect(transitionStatusSpy).toHaveBeenCalledWith('c1', 'submit_review', 'u1');
    expect(broadcastSpy).toHaveBeenCalledWith(
      'AUDIT_PENDING',
      expect.objectContaining({ refType: 'Case', refId: 'c1' }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'review:submit',
        payload: { conclusion: 'PASS', photoCount: 0 },
      }),
    });
    // No photos passed → no createMany call
    expect(tx.reviewPhoto.createMany).not.toHaveBeenCalled();
  });

  it('submit persists offline photos in the same transaction', async () => {
    const reviewRow = {
      id: 'r1',
      caseId: 'c1',
      reviewerId: 'u-inspector',
      templateId: 't1',
      claimedById: 'u1',
      status: 'IN_PROGRESS',
    };
    const tx = {
      review: {
        findFirst: vi.fn().mockResolvedValueOnce(reviewRow),
        update: vi.fn().mockResolvedValueOnce({ ...reviewRow, status: 'SUBMITTED' }),
      },
      auditLog: { create: vi.fn() },
      reviewPhoto: { createMany: vi.fn().mockResolvedValueOnce({ count: 2 }) },
    };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
    transitionStatusSpy.mockResolvedValueOnce({});
    broadcastSpy.mockResolvedValueOnce({ count: 2 });

    const photos = [
      { storageKey: 'photos/a.jpg', takenAt: new Date() },
      { storageKey: 'photos/b.jpg', takenAt: new Date(), gpsLat: 1.23, gpsLng: 4.56 },
    ];
    const { ReviewService } = await import('@/services/review');
    await ReviewService.submit('c1', 'FAIL', 'see photos', 'u1', photos);

    expect(tx.reviewPhoto.createMany).toHaveBeenCalledWith({
      data: [
        { storageKey: 'photos/a.jpg', takenAt: photos[0].takenAt, reviewId: 'r1', capturedById: 'u1', syncStatus: 'SYNCED' },
        { storageKey: 'photos/b.jpg', takenAt: photos[1].takenAt, gpsLat: 1.23, gpsLng: 4.56, reviewId: 'r1', capturedById: 'u1', syncStatus: 'SYNCED' },
      ],
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'review:submit',
        payload: { conclusion: 'FAIL', photoCount: 2 },
      }),
    });
  });

  it('submit rejects when no in-progress review exists', async () => {
    const tx = {
      review: { findFirst: vi.fn().mockResolvedValueOnce(null), update: vi.fn() },
      reviewPhoto: { createMany: vi.fn() },
    };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.submit('c1', 'PASS', 'done', 'u1')).rejects.toMatchObject({
      code: 'no_active_review',
    });
  });

  it('submit rejects when not claimed by you', async () => {
    const reviewRow = { id: 'r1', caseId: 'c1', claimedById: 'someone-else', status: 'IN_PROGRESS' };
    const tx = {
      review: { findFirst: vi.fn().mockResolvedValueOnce(reviewRow), update: vi.fn() },
      reviewPhoto: { createMany: vi.fn() },
    };
    const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.submit('c1', 'PASS', 'done', 'u1')).rejects.toMatchObject({
      code: 'not_claimed_by_you',
    });
  });
});
