import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'n1' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'n1', readAt: new Date() }),
    },
  },
}));

import { NotificationService } from '@/services/notification';

describe('NotificationService', () => {
  it('create writes a notification', async () => {
    const n = await NotificationService.create('u1', 'AUDIT_PENDING', {
      refType: 'Case',
      refId: 'c1',
      title: 't',
      body: 'b',
    });
    expect(n.id).toBe('n1');
  });
});
