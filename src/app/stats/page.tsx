import { auth } from '@/lib/auth';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { Card } from '@/components/ui/card';

export default async function StatsPage() {
  await auth();
  const [kpi, trend, dist] = await Promise.all([
    StatsService.kpi(),
    StatsService.trend(30),
    StatsService.distribution('hazardType'),
  ]);
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">统计</h1>
      <KpiCards kpi={kpi} />
      <Card className="p-4">
        <h2 className="font-medium mb-2">近 30 天趋势</h2>
        <pre className="text-xs overflow-auto">{JSON.stringify(trend, null, 2)}</pre>
      </Card>
      <Card className="p-4">
        <h2 className="font-medium mb-2">按隐患类型分布</h2>
        <pre className="text-xs overflow-auto">{JSON.stringify(dist, null, 2)}</pre>
      </Card>
    </main>
  );
}
