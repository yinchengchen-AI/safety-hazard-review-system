import { describe, it, expect, beforeEach, vi } from 'vitest';

function buildPrisma() {
  return {
    case: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  };
}

describe('StatsService', () => {
  let m: ReturnType<typeof buildPrisma>;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m = buildPrisma();
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));
  });

  it('kpi returns total + closed counts and a closure rate', async () => {
    m.case.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(20) // closed
      .mockResolvedValueOnce(10) // inAudit
      .mockResolvedValueOnce(70); // pending

    const { StatsService } = await import('@/services/stats');
    const k = await StatsService.kpi();
    expect(k).toEqual({ total: 100, closed: 20, inAudit: 10, pending: 70, closureRate: 0.2 });
  });

  it('kpi handles zero total by returning closureRate 0', async () => {
    m.case.count.mockResolvedValueOnce(0);
    const { StatsService } = await import('@/services/stats');
    const k = await StatsService.kpi();
    expect(k.total).toBe(0);
    expect(k.closureRate).toBe(0);
  });

  it('trend buckets registered + closed counts per day', async () => {
    const today = new Date('2026-06-20T00:00:00Z');
    m.case.findMany.mockResolvedValueOnce([
      { registeredAt: today, status: 'CLOSED', closedAt: today },
      { registeredAt: today, status: 'PENDING_REVIEW', closedAt: null },
      { registeredAt: new Date('2026-06-19T12:00:00Z'), status: 'CLOSED', closedAt: new Date('2026-06-19T13:00:00Z') },
    ]);
    const { StatsService } = await import('@/services/stats');
    const t = await StatsService.trend(7);
    const byDay = Object.fromEntries(t.map((r) => [r.day, r]));
    expect(byDay['2026-06-20'].registered).toBe(2);
    expect(byDay['2026-06-20'].closed).toBe(1);
    expect(byDay['2026-06-19'].registered).toBe(1);
    expect(byDay['2026-06-19'].closed).toBe(1);
  });

  it('distribution by hazardType delegates to groupBy on hazardTypeId', async () => {
    m.case.groupBy.mockResolvedValueOnce([{ hazardTypeId: 'h1', _count: 5 }]);
    const { StatsService } = await import('@/services/stats');
    const r = await StatsService.distribution('hazardType');
    expect(m.case.groupBy).toHaveBeenCalledWith({ by: ['hazardTypeId'], _count: true });
    expect(r).toEqual([{ hazardTypeId: 'h1', _count: 5 }]);
  });

  it('distribution by severity delegates to groupBy on severity', async () => {
    m.case.groupBy.mockResolvedValueOnce([
      { severity: 'MAJOR', _count: 3 },
      { severity: 'MINOR', _count: 7 },
    ]);
    const { StatsService } = await import('@/services/stats');
    const r = await StatsService.distribution('severity');
    expect(m.case.groupBy).toHaveBeenCalledWith({ by: ['severity'], _count: true });
    expect(r).toHaveLength(2);
  });

  it('distribution by enterprise caps at top 20 ordered by count desc', async () => {
    m.case.groupBy.mockResolvedValueOnce([{ enterpriseId: 'e1', _count: 50 }]);
    const { StatsService } = await import('@/services/stats');
    const r = await StatsService.distribution('enterprise');
    expect(m.case.groupBy).toHaveBeenCalledWith({
      by: ['enterpriseId'],
      _count: true,
      orderBy: { _count: { enterpriseId: 'desc' } },
      take: 20,
    });
    expect(r).toEqual([{ enterpriseId: 'e1', _count: 50 }]);
  });
});
