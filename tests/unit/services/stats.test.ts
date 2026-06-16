import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    case: {
      count: vi
        .fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(70),
      groupBy: vi.fn().mockResolvedValue([{ hazardTypeId: 'h1', _count: 50 }]),
    },
  },
}));

import { StatsService } from '@/services/stats';

describe('StatsService', () => {
  it('kpi returns total + closed counts', async () => {
    const k = await StatsService.kpi();
    expect(k.total).toBe(100);
    expect(k.closed).toBe(20);
  });
});
