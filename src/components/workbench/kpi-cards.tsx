import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Kpi = { total: number; closed: number; inAudit: number; pending: number; closureRate: number };

const items: { label: string; key: keyof Kpi; color: string }[] = [
  { label: '总案件', key: 'total', color: 'border-l-gov-blue' },
  { label: '已销案', key: 'closed', color: 'border-l-green-500' },
  { label: '审核中', key: 'inAudit', color: 'border-l-blue-500' },
  { label: '待处理', key: 'pending', color: 'border-l-amber-500' },
];

export function KpiCards({ kpi }: { kpi: Kpi }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.key} className={cn('border-l-4', item.color)}>
          <CardContent className="p-4">
            <p className="text-xs md:text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1">{kpi[item.key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
