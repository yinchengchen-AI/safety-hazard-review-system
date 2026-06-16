import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendChart } from '@/components/stats/trend-chart';
import { DistributionChart } from '@/components/stats/distribution-chart';

const statusData = [
  { name: '待复核', value: 24, color: 'bg-amber-400' },
  { name: '待审核', value: 12, color: 'bg-blue-500' },
  { name: '审核中', value: 6, color: 'bg-purple-500' },
  { name: '已销案', value: 86, color: 'bg-green-500' },
];

export default async function StatsPage() {
  await auth();
  const [kpi, trend] = await Promise.all([
    StatsService.kpi(),
    StatsService.trend(30),
  ]);
  const dist = (await StatsService.distribution('hazardType')) as { hazardTypeId: string; _count: number }[];

  const trendData = trend.map((t) => ({
    date: t.day.slice(5),
    count: t.registered,
  }));

  const hazardTypes = await prisma.hazardType.findMany({ select: { id: true, name: true } });
  const hazardTypeMap = new Map(hazardTypes.map((h) => [h.id, h.name]));

  const distData = dist.map((d, i) => ({
    name: hazardTypeMap.get(d.hazardTypeId) ?? d.hazardTypeId,
    value: d._count,
    color: ['bg-gov-blue', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'][i % 4],
  }));

  return (
    <PageShell title="统计分析">
      <KpiCards kpi={kpi} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">近 30 天案件趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">隐患类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionChart data={distData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusData.map((s) => (
              <div key={s.name} className="rounded-xl p-4 text-center bg-muted">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
