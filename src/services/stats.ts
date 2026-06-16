import { prisma } from '@/lib/prisma';

export const StatsService = {
  async kpi() {
    const [total, closed, inAudit, pending] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { status: 'CLOSED' } }),
      prisma.case.count({ where: { status: 'IN_AUDIT' } }),
      prisma.case.count({ where: { status: { in: ['PENDING_REVIEW', 'PENDING_AUDIT'] } } }),
    ]);
    return { total, closed, inAudit, pending, closureRate: total === 0 ? 0 : closed / total };
  },

  async trend(days: number) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.case.findMany({
      where: { registeredAt: { gte: since } },
      select: { registeredAt: true, status: true, closedAt: true },
    });
    const buckets: Record<string, { registered: number; closed: number }> = {};
    for (const r of rows) {
      const day = r.registeredAt.toISOString().slice(0, 10);
      buckets[day] = buckets[day] || { registered: 0, closed: 0 };
      buckets[day].registered++;
      if (r.closedAt) buckets[day].closed++;
    }
    return Object.entries(buckets).map(([day, v]) => ({ day, ...v }));
  },

  async distribution(by: 'hazardType' | 'enterprise' | 'severity') {
    if (by === 'hazardType') {
      return prisma.case.groupBy({ by: ['hazardTypeId'], _count: true });
    }
    if (by === 'severity') {
      return prisma.case.groupBy({ by: ['severity'], _count: true });
    }
    return prisma.case.groupBy({
      by: ['enterpriseId'],
      _count: true,
      orderBy: { _count: { enterpriseId: 'desc' } },
      take: 20,
    });
  },
};
