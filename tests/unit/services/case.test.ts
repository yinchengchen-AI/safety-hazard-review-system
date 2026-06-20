import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildMocks() {
  const caseCreate = vi.fn();
  const caseUpdate = vi.fn();
  const caseFindUnique = vi.fn();
  const caseFindFirst = vi.fn();
  const caseFindMany = vi.fn();
  const caseCount = vi.fn();
  const reviewCreate = vi.fn();
  const auditCreate = vi.fn();
  const executeRaw = vi.fn().mockResolvedValue(undefined);
  const tx = {
    case: {
      create: caseCreate,
      update: caseUpdate,
      findUnique: caseFindUnique,
      findFirst: caseFindFirst,
      findMany: caseFindMany,
      count: caseCount,
    },
    review: { create: reviewCreate },
    auditLog: { create: auditCreate },
    // generateCaseCode now does an advisory lock + findFirst
    $executeRaw: executeRaw,
  };
  const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  return {
    tx,
    transaction,
    caseCreate,
    caseUpdate,
    caseFindUnique,
    caseFindFirst,
    caseFindMany,
    caseCount,
    reviewCreate,
    auditCreate,
    executeRaw,
  };
}

describe('CaseService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('register creates case with PENDING_REVIEW + empty review + audit', async () => {
    const m = buildMocks();
    m.caseCreate.mockResolvedValueOnce({ id: 'c1', code: 'CASE-1', status: 'PENDING_REVIEW' });
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { CaseService } = await import('@/services/case');

    const c = await CaseService.register(
      {
        enterpriseId: 'e1',
        hazardTypeId: 'h1',
        severity: 'MAJOR',
        source: '监管检查',
        description: 'desc',
        address: 'addr',
        deadline: new Date(),
        templateId: 't1',
        reviewerId: 'u1',
      },
      'u1',
    );
    expect(c.status).toBe('PENDING_REVIEW');
    expect(m.caseCreate).toHaveBeenCalled();
    expect(m.reviewCreate).toHaveBeenCalled();
    expect(m.auditCreate).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'register', targetType: 'Case', targetId: 'c1' },
    });
    // code-generator needs advisory lock + a (possibly null) findFirst result
    expect(m.executeRaw).toHaveBeenCalled();
    expect(m.caseFindFirst).toHaveBeenCalled();
  });

  it('getById delegates to prisma.case.findUnique', async () => {
    const m = buildMocks();
    m.caseFindUnique.mockResolvedValueOnce({ id: 'c1' });
    vi.doMock('@/lib/prisma', () => ({ prisma: { case: { findUnique: m.caseFindUnique } } }));
    const { CaseService } = await import('@/services/case');
    const r = await CaseService.getById('c1');
    expect(m.caseFindUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(r).toEqual({ id: 'c1' });
  });

  it('list applies filters and returns items + total + page + pageSize', async () => {
    const findMany = vi.fn().mockResolvedValueOnce([{ id: 'c1' }]);
    const count = vi.fn().mockResolvedValueOnce(42);
    vi.doMock('@/lib/prisma', () => ({
      prisma: { case: { findMany, count } },
    }));
    const { CaseService } = await import('@/services/case');
    const r = await CaseService.list({
      status: 'PENDING_REVIEW',
      hazardTypeId: 'h1',
      enterpriseId: 'e1',
      page: 2,
      pageSize: 5,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING_REVIEW', hazardTypeId: 'h1', enterpriseId: 'e1' },
      orderBy: { registeredAt: 'desc' },
      skip: 5,
      take: 5,
      include: {
        enterprise: true,
        hazardType: true,
        registeredBy: { select: { name: true } },
      },
    });
    expect(r).toEqual({ items: [{ id: 'c1' }], total: 42, page: 2, pageSize: 5 });
  });

  it('list with no filters omits where clauses', async () => {
    const findMany = vi.fn().mockResolvedValueOnce([]);
    const count = vi.fn().mockResolvedValueOnce(0);
    vi.doMock('@/lib/prisma', () => ({ prisma: { case: { findMany, count } } }));
    const { CaseService } = await import('@/services/case');
    await CaseService.list({ page: 1, pageSize: 10 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 10 }),
    );
  });

  it('transitionStatus throws not_found when case missing', async () => {
    const m = buildMocks();
    m.caseFindUnique.mockResolvedValueOnce(null);
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { CaseService } = await import('@/services/case');
    await expect(CaseService.transitionStatus('c1', 'sign', 'u1')).rejects.toMatchObject({
      code: 'not_found',
      httpStatus: 404,
    });
  });

  it('transitionStatus on sign stamps closedAt and clears lock', async () => {
    const m = buildMocks();
    m.caseFindUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'IN_AUDIT',
      lockedById: 'u1',
      lockedAt: new Date(),
    });
    m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'CLOSED' });
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { CaseService } = await import('@/services/case');
    await CaseService.transitionStatus('c1', 'sign', 'u1');
    expect(m.caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({
          status: 'CLOSED',
          closedAt: expect.any(Date),
          lockedById: null,
          lockedAt: null,
        }),
      }),
    );
    expect(m.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'case:sign',
        payload: { from: 'IN_AUDIT', to: 'CLOSED' },
      }),
    });
  });

  it('transitionStatus on open_audit sets lockedById + lockedAt', async () => {
    const m = buildMocks();
    m.caseFindUnique.mockResolvedValueOnce({ id: 'c1', status: 'PENDING_AUDIT' });
    m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT' });
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { CaseService } = await import('@/services/case');
    await CaseService.transitionStatus('c1', 'open_audit', 'u1');
    expect(m.caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'IN_AUDIT',
          lockedById: 'u1',
          lockedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('transitionStatus on reject clears the lock and writes audit payload', async () => {
    const m = buildMocks();
    m.caseFindUnique.mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u1' });
    m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'PENDING_REVIEW' });
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { CaseService } = await import('@/services/case');
    await CaseService.transitionStatus('c1', 'reject', 'u1');
    expect(m.caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING_REVIEW',
          lockedById: null,
          lockedAt: null,
        }),
      }),
    );
    expect(m.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'case:reject',
        payload: { from: 'IN_AUDIT', to: 'PENDING_REVIEW' },
      }),
    });
  });
});
