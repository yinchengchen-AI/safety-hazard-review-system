import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildPrisma() {
  return {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: { findMany: vi.fn() },
  };
}

describe('NotificationService', () => {
  let m: ReturnType<typeof buildPrisma>;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m = buildPrisma();
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));
  });

  it('create writes a notification', async () => {
    m.notification.create.mockResolvedValueOnce({ id: 'n1' });
    const { NotificationService } = await import('@/services/notification');
    const n = await NotificationService.create('u1', 'AUDIT_PENDING', {
      refType: 'Case',
      refId: 'c1',
      title: 't',
      body: 'b',
    });
    expect(n.id).toBe('n1');
    expect(m.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        type: 'AUDIT_PENDING',
        refType: 'Case',
        refId: 'c1',
        title: 't',
        body: 'b',
      },
    });
  });

  it('broadcastToChiefs returns [] when no active chiefs', async () => {
    m.user.findMany.mockResolvedValueOnce([]);
    const { NotificationService } = await import('@/services/notification');
    const r = await NotificationService.broadcastToChiefs('DEADLINE_OVERDUE', {
      title: 't',
      body: 'b',
    });
    expect(r).toEqual([]);
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it('broadcastToChiefs creates one notification per active chief', async () => {
    m.user.findMany.mockResolvedValueOnce([{ id: 'k1' }, { id: 'k2' }]);
    m.notification.createMany.mockResolvedValueOnce({ count: 2 });
    const { NotificationService } = await import('@/services/notification');
    const r = await NotificationService.broadcastToChiefs('AUDIT_PENDING', {
      refType: 'Case',
      refId: 'c1',
      title: 't',
      body: 'b',
    });
    expect(m.user.findMany).toHaveBeenCalledWith({
      where: { role: 'CHIEF', status: 'ACTIVE' },
      select: { id: true },
    });
    expect(m.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'k1',
          type: 'AUDIT_PENDING',
          refType: 'Case',
          refId: 'c1',
          title: 't',
          body: 'b',
        },
        {
          userId: 'k2',
          type: 'AUDIT_PENDING',
          refType: 'Case',
          refId: 'c1',
          title: 't',
          body: 'b',
        },
      ],
    });
    expect(r).toEqual({ count: 2 });
  });

  it('list paginates and returns total + page + pageSize', async () => {
    m.notification.findMany.mockResolvedValueOnce([{ id: 'n1' }, { id: 'n2' }]);
    m.notification.count.mockResolvedValueOnce(7);
    const { NotificationService } = await import('@/services/notification');
    const r = await NotificationService.list('u1', 2, 5);
    expect(m.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(r).toEqual({ items: [{ id: 'n1' }, { id: 'n2' }], total: 7, page: 2, pageSize: 5 });
  });

  it('markRead scopes the update by id + userId and stamps readAt', async () => {
    m.notification.update.mockResolvedValueOnce({ id: 'n1', readAt: new Date() });
    const { NotificationService } = await import('@/services/notification');
    const r = await NotificationService.markRead('n1', 'u1');
    expect(m.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'u1' },
      data: { readAt: expect.any(Date) },
    });
    expect(r.id).toBe('n1');
  });
});
