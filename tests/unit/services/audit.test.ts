import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildMocks() {
  const $queryRaw = vi.fn();
  const caseFindUnique = vi.fn();
  const caseUpdate = vi.fn();
  const auditSignatureCreate = vi.fn();
  const reviewFindFirst = vi.fn();
  const reviewUpdate = vi.fn();
  const reviewCreate = vi.fn();
  const auditLogCreate = vi.fn();
  const tx = {
    $queryRaw,
    case: { findUnique: caseFindUnique, update: caseUpdate },
    auditSignature: { create: auditSignatureCreate },
    review: { findFirst: reviewFindFirst, update: reviewUpdate, create: reviewCreate },
    auditLog: { create: auditLogCreate },
  };
  const transaction = vi.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  return {
    tx,
    transaction,
    $queryRaw,
    caseFindUnique,
    caseUpdate,
    auditSignatureCreate,
    reviewFindFirst,
    reviewUpdate,
    reviewCreate,
    auditLogCreate,
  };
}

function mockPrisma(m: { transaction: ReturnType<typeof vi.fn> }) {
  vi.doMock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
}

describe('AuditService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('openAudit', () => {
    it('locks the case and transitions to IN_AUDIT', async () => {
      const m = buildMocks();
      m.$queryRaw.mockResolvedValueOnce([
        { id: 'c1', status: 'PENDING_AUDIT', lockedById: null },
      ]);
      m.caseFindUnique.mockResolvedValueOnce({ id: 'c1', status: 'PENDING_AUDIT' });
      m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT' });
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      const c = await AuditService.openAudit('c1', 'u1');
      expect(c.status).toBe('IN_AUDIT');
    });

    it('throws not_found when case missing', async () => {
      const m = buildMocks();
      m.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await expect(AuditService.openAudit('c1', 'u1')).rejects.toMatchObject({
        code: 'not_found',
        httpStatus: 404,
      });
    });

    it('rejects when case is not in PENDING_AUDIT', async () => {
      const m = buildMocks();
      m.$queryRaw.mockResolvedValueOnce([{ id: 'c1', status: 'CLOSED', lockedById: null }]);
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await expect(AuditService.openAudit('c1', 'u1')).rejects.toMatchObject({
        code: 'invalid_state',
        httpStatus: 409,
      });
    });

    it('rejects when another user holds the lock', async () => {
      const m = buildMocks();
      m.$queryRaw.mockResolvedValueOnce([
        { id: 'c1', status: 'PENDING_AUDIT', lockedById: 'u2' },
      ]);
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await expect(AuditService.openAudit('c1', 'u1')).rejects.toMatchObject({
        code: 'locked_by_other',
        httpStatus: 409,
      });
    });
  });

  describe('sign', () => {
    it('creates AuditSignature + transitions case to CLOSED', async () => {
      const m = buildMocks();
      m.caseFindUnique
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u1' })
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT' });
      m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'CLOSED' });
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await AuditService.sign('c1', 'u1', 'sig.png', 'looks good');
      expect(m.auditSignatureCreate).toHaveBeenCalledWith({
        data: {
          caseId: 'c1',
          auditorId: 'u1',
          decision: 'PASS',
          signatureUrl: 'sig.png',
          comment: 'looks good',
        },
      });
      expect(m.auditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'audit:sign', payload: { comment: 'looks good' } }),
      });
    });

    it('rejects if case is not IN_AUDIT or not locked by actor', async () => {
      const m = buildMocks();
      m.caseFindUnique.mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u2' });
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await expect(AuditService.sign('c1', 'u1', 'sig.png', 'cmt')).rejects.toMatchObject({
        code: 'not_locked_by_you',
        httpStatus: 403,
      });
    });
  });

  describe('reject', () => {
    it('marks current Review RETURNED, opens a new one, writes AuditSignature, transitions case', async () => {
      const m = buildMocks();
      m.caseFindUnique
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u1' })
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT' });
      m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'PENDING_REVIEW' });
      m.reviewFindFirst.mockResolvedValueOnce({
        id: 'r1',
        reviewerId: 'u-inspector',
        templateId: 't1',
      });
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await AuditService.reject('c1', 'u1', 'not good');
      expect(m.reviewUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'RETURNED' },
      });
      expect(m.reviewCreate).toHaveBeenCalledWith({
        data: {
          caseId: 'c1',
          reviewerId: 'u-inspector',
          templateId: 't1',
          status: 'IN_PROGRESS',
        },
      });
      expect(m.auditSignatureCreate).toHaveBeenCalledWith({
        data: {
          caseId: 'c1',
          auditorId: 'u1',
          decision: 'REJECT',
          comment: 'not good',
          signatureUrl: '',
        },
      });
      expect(m.auditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'audit:reject', payload: { reason: 'not good' } }),
      });
    });

    it('skips review update if no submitted review found', async () => {
      const m = buildMocks();
      m.caseFindUnique
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT', lockedById: 'u1' })
        .mockResolvedValueOnce({ id: 'c1', status: 'IN_AUDIT' });
      m.caseUpdate.mockResolvedValueOnce({ id: 'c1', status: 'PENDING_REVIEW' });
      m.reviewFindFirst.mockResolvedValueOnce(null);
      mockPrisma(m);

      const { AuditService } = await import('@/services/audit');
      await AuditService.reject('c1', 'u1', 'reason');
      expect(m.reviewUpdate).not.toHaveBeenCalled();
      expect(m.reviewCreate).not.toHaveBeenCalled();
      expect(m.auditSignatureCreate).toHaveBeenCalled();
    });
  });
});
