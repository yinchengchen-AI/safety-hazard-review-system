import { Card } from '@/components/ui/card';

type Kpi = { total: number; closed: number; inAudit: number; pending: number; closureRate: number };

export function KpiCards({ kpi }: { kpi: Kpi }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: '总案件', value: kpi.total },
        { label: '已销案', value: kpi.closed },
        { label: '审核中', value: kpi.inAudit },
        { label: '待处理', value: kpi.pending },
      ].map((c) => (
        <Card key={c.label} className="p-4">
          <div className="text-sm text-muted-foreground">{c.label}</div>
          <div className="text-3xl font-semibold mt-1">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
