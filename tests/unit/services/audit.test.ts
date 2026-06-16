import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildMocks() {
  const caseRow = { id: 'c1', status: 'PENDING_AUDIT', lockedById: null };
  const findUniqueCase = vi.fn().mockResolvedValue({ id: 'c1', status: 'PENDING_AUDIT', lockedById: null });
  const updateCase = vi.fn().mockResolvedValue({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u1' });
  const auditSigCreate = vi.fn();
  const reviewFindFirst = vi.fn().mockResolvedValue({ id: 'r1' });
  const reviewUpdate = vi.fn();
  const reviewCreate = vi.fn();
  const auditLogCreate = vi.fn();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([caseRow]),
    case: { findUnique: findUniqueCase, update: updateCase },
    auditSignature: { create: auditSigCreate },
    review: { findFirst: reviewFindFirst, update: reviewUpdate, create: reviewCreate },
    auditLog: { create: auditLogCreate },
  };
  const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  return { tx, transaction, updateCase, auditSigCreate, auditLogCreate };
}

describe('AuditService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('openAudit locks case and moves to IN_AUDIT', async () => {
    const m = buildMocks();
    vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
    const { AuditService } = await import('@/services/audit');
    const c = await AuditService.openAudit('c1', 'u1');
    expect(c.status).toBe('IN_AUDIT');
  });
});
