import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

type Review = {
  id: string;
  status: string;
  reviewer: { name: string };
  submittedAt?: Date | null;
  conclusion?: string | null;
  summary?: string | null;
};

export function CaseTimeline({ reviews }: { reviews: Review[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">复核历史</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无复核记录</p>
        ) : (
          <div className="relative space-y-4 pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
            {reviews.map((r) => (
              <div key={r.id} className="relative">
                <div className="absolute -left-[13px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</div>
                  <div className="text-xs text-muted-foreground">
                    复核人：{r.reviewer.name} · {r.submittedAt?.toLocaleString('zh-CN') ?? '未提交'}
                  </div>
                  {r.conclusion && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      结论：{r.conclusion} {r.summary ? `· ${r.summary}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
