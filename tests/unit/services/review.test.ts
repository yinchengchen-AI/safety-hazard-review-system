import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildMocks(opts: { reviewLastActiveMs: number; reviewClaimedById: string | null }) {
  const reviewRow = {
    id: 'r1',
    caseId: 'c1',
    claimedById: opts.reviewClaimedById,
    lastActiveAt: new Date(Date.now() - opts.reviewLastActiveMs),
    status: 'IN_PROGRESS' as const,
  };
  const update = vi.fn().mockResolvedValue({ ...reviewRow, claimedById: 'u2' });
  const auditCreate = vi.fn();
  const caseUpdate = vi.fn();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([reviewRow]),
    review: { update, findFirst: vi.fn() },
    case: { update: caseUpdate },
    auditLog: { create: auditCreate },
  };
  const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  return { tx, transaction, update, auditCreate };
}

describe('ReviewService.takeOver', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('allows takeover when lastActiveAt > 24h ago', async () => {
    const m = buildMocks({ reviewLastActiveMs: 25 * 3600 * 1000, reviewClaimedById: 'u1' });
    vi.doMock('@/lib/prisma', () => ({
      prisma: { $transaction: m.transaction, case: { update: vi.fn() } },
    }));
    const { ReviewService } = await import('@/services/review');
    const r = await ReviewService.takeOver('c1', 'u2');
    expect(r.claimedById).toBe('u2');
    expect(m.auditCreate).toHaveBeenCalled();
  });

  it('rejects takeover within 24h of last activity', async () => {
    const m = buildMocks({ reviewLastActiveMs: 1 * 3600 * 1000, reviewClaimedById: 'u1' });
    vi.doMock('@/lib/prisma', () => ({
      prisma: { $transaction: m.transaction, case: { update: vi.fn() } },
    }));
    const { ReviewService } = await import('@/services/review');
    await expect(ReviewService.takeOver('c1', 'u2')).rejects.toThrow(/active/);
  });
});
