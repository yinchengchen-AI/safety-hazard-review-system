import { cn } from '@/lib/utils';

export function DistributionChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.name}>
          <div className="flex justify-between text-sm mb-1">
            <span>{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn('h-2 rounded-full', item.color)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
