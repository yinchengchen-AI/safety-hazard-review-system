import { describe, it, expect, beforeEach, vi } from 'vitest';

const createSpy = vi.fn(async (_userId: string, _type: string, _opts: unknown) => ({}));
const broadcastSpy = vi.fn(async (_type: string, _opts: unknown) => ({ count: 0 }));

vi.mock('@/services/notification', () => ({
  NotificationService: {
    create: createSpy,
    broadcastToChiefs: broadcastSpy,
  },
}));

function buildPrismaMock(soonCases: unknown[], overdueCases: unknown[]) {
  const caseFindMany = vi
    .fn()
    .mockResolvedValueOnce(soonCases)
    .mockResolvedValueOnce(overdueCases);
  const notificationFindFirst = vi.fn();
  return { case: { findMany: caseFindMany }, notification: { findFirst: notificationFindFirst } };
}

describe('notification-cron.scanDeadlines', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('emits DEADLINE_SOON when no notification was sent today', async () => {
    const m = buildPrismaMock(
      [
        {
          id: 'c1',
          code: 'CASE-1',
          registeredById: 'u1',
          registeredBy: { name: '张三' },
          deadline: new Date(Date.now() + 2 * 86400_000),
        },
      ],
      [],
    );
    m.notification.findFirst.mockResolvedValueOnce(null);
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));

    const { scanDeadlines } = await import('@/workers/notification-cron');
    await scanDeadlines();

    expect(createSpy).toHaveBeenCalledWith(
      'u1',
      'DEADLINE_SOON',
      expect.objectContaining({
        refType: 'Case',
        refId: 'c1',
        title: expect.stringContaining('CASE-1'),
      }),
    );
  });

  it('skips DEADLINE_SOON if a same-day notification already exists', async () => {
    const m = buildPrismaMock(
      [
        {
          id: 'c1',
          code: 'CASE-1',
          registeredById: 'u1',
          registeredBy: { name: '张三' },
          deadline: new Date(Date.now() + 2 * 86400_000),
        },
      ],
      [],
    );
    m.notification.findFirst.mockResolvedValueOnce({ id: 'n0' });
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));

    const { scanDeadlines } = await import('@/workers/notification-cron');
    await scanDeadlines();

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('emits DEADLINE_OVERDUE to creator + broadcasts to chiefs', async () => {
    const m = buildPrismaMock(
      [],
      [
        {
          id: 'c2',
          code: 'CASE-2',
          registeredById: 'u1',
          registeredBy: { name: '张三' },
          deadline: new Date(Date.now() - 86400_000),
        },
      ],
    );
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));

    const { scanDeadlines } = await import('@/workers/notification-cron');
    await scanDeadlines();

    expect(createSpy).toHaveBeenCalledWith(
      'u1',
      'DEADLINE_OVERDUE',
      expect.objectContaining({ refId: 'c2' }),
    );
    expect(broadcastSpy).toHaveBeenCalledWith(
      'DEADLINE_OVERDUE',
      expect.objectContaining({ refId: 'c2' }),
    );
  });

  it('does nothing when there are no soon or overdue cases', async () => {
    const m = buildPrismaMock([], []);
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));

    const { scanDeadlines } = await import('@/workers/notification-cron');
    await scanDeadlines();

    expect(createSpy).not.toHaveBeenCalled();
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
