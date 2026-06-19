import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    offlineSyncQueue: {
      upsert: vi.fn().mockResolvedValue({ id: 'q1' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    review: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { SyncService } from '@/services/sync';

describe('SyncService', () => {
  it('enqueue is idempotent by clientId', async () => {
    const r = await SyncService.enqueue(
      'u1',
      '550e8400-e29b-41d4-a716-446655440000',
      'submit_review',
      { foo: 1 },
    );
    expect(r.id).toBe('q1');
  });
});
