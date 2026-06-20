import { describe, it, expect, beforeEach, vi } from 'vitest';

const submitSpy = vi.fn();
const enqueueSpy = vi.fn();

vi.mock('@/services/review', () => ({
  ReviewService: { submit: (...args: unknown[]) => submitSpy(...args) },
}));

function buildPrisma() {
  return {
    offlineSyncQueue: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('SyncService', () => {
  let m: ReturnType<typeof buildPrisma>;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m = buildPrisma();
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));
  });

  describe('enqueue', () => {
    it('upserts a queue row by (userId, clientId)', async () => {
      m.offlineSyncQueue.upsert.mockResolvedValueOnce({ id: 'q1' });
      const { SyncService } = await import('@/services/sync');
      const r = await SyncService.enqueue('u1', 'c-1', 'submit_review', { foo: 'bar' });
      expect(m.offlineSyncQueue.upsert).toHaveBeenCalledWith({
        where: { userId_clientId: { userId: 'u1', clientId: 'c-1' } },
        create: {
          userId: 'u1',
          clientId: 'c-1',
          opType: 'submit_review',
          payload: { foo: 'bar' },
          status: 'PENDING',
        },
        update: {},
      });
      expect(r.id).toBe('q1');
    });
  });

  describe('processOne', () => {
    it('returns null when queue row missing or not PENDING', async () => {
      // missing
      m.$transaction.mockImplementationOnce(async (fn: (tx: typeof m) => unknown) =>
        fn({ ...m, offlineSyncQueue: { ...m.offlineSyncQueue, findUnique: vi.fn().mockResolvedValueOnce(null) } }),
      );
      const { SyncService } = await import('@/services/sync');
      expect(await SyncService.processOne('q-missing')).toBeNull();

      // not pending
      m.$transaction.mockImplementationOnce(async (fn: (tx: typeof m) => unknown) =>
        fn({
          ...m,
          offlineSyncQueue: {
            ...m.offlineSyncQueue,
            findUnique: vi.fn().mockResolvedValueOnce({ id: 'q1', status: 'SYNCED' }),
          },
        }),
      );
      expect(await SyncService.processOne('q-synced')).toBeNull();
    });

    it('runs submit_review and marks the queue row SYNCED', async () => {
      const queueRow = {
        id: 'q1',
        opType: 'submit_review',
        userId: 'u1',
        payload: { caseId: 'c1', conclusion: 'PASS', summary: 'ok' },
        status: 'PENDING',
        retryCount: 0,
      };
      submitSpy.mockResolvedValueOnce({});
      const tx = {
        offlineSyncQueue: {
          findUnique: vi.fn().mockResolvedValueOnce(queueRow),
          update: vi.fn().mockResolvedValueOnce({ ...queueRow, status: 'SYNCED' }),
        },
      };
      m.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const { SyncService } = await import('@/services/sync');
      const r = await SyncService.processOne('q1');
      expect(submitSpy).toHaveBeenCalledWith('c1', 'PASS', 'ok', 'u1');
      expect(tx.offlineSyncQueue.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: { status: 'SYNCED', syncedAt: expect.any(Date) },
      });
    });

    it('marks FAILED when retryCount >= 3, otherwise leaves PENDING + increment', async () => {
      const queueRow = {
        id: 'q1',
        opType: 'submit_review',
        userId: 'u1',
        payload: { caseId: 'c1' },
        status: 'PENDING',
        retryCount: 3,
      };
      submitSpy.mockRejectedValueOnce(new Error('downstream'));
      const tx = {
        offlineSyncQueue: {
          findUnique: vi.fn().mockResolvedValueOnce(queueRow),
          update: vi.fn().mockResolvedValueOnce({ ...queueRow, status: 'FAILED' }),
        },
      };
      m.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const { SyncService } = await import('@/services/sync');
      await expect(SyncService.processOne('q1')).rejects.toThrow('downstream');
      expect(tx.offlineSyncQueue.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: {
          status: 'FAILED',
          retryCount: { increment: 1 },
          errorMsg: 'downstream',
        },
      });
    });

    it('throws BusinessError on unknown opType', async () => {
      const queueRow = {
        id: 'q1',
        opType: 'mystery_op',
        userId: 'u1',
        payload: {},
        status: 'PENDING',
        retryCount: 0,
      };
      const tx = {
        offlineSyncQueue: {
          findUnique: vi.fn().mockResolvedValueOnce(queueRow),
          update: vi.fn(),
        },
      };
      m.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => fn(tx));
      const { SyncService } = await import('@/services/sync');
      await expect(SyncService.processOne('q1')).rejects.toThrow(/Unknown opType/);
    });
  });

  describe('listPending', () => {
    it('returns PENDING and FAILED rows ordered by createdAt asc', async () => {
      m.offlineSyncQueue.findMany.mockResolvedValueOnce([{ id: 'q1' }]);
      const { SyncService } = await import('@/services/sync');
      const r = await SyncService.listPending('u1');
      expect(m.offlineSyncQueue.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', status: { in: ['PENDING', 'FAILED'] } },
        orderBy: { createdAt: 'asc' },
      });
      expect(r).toEqual([{ id: 'q1' }]);
    });
  });
});
