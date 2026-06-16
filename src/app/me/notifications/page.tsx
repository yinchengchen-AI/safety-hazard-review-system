import { auth } from '@/lib/auth';
import { NotificationService } from '@/services/notification';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) return null;
  const { items } = await NotificationService.list(session.user.id, 1, 50);
  return (
    <PageShell title="通知中心">
      <div className="space-y-3 max-w-3xl">
        {items.length === 0 && <p className="text-sm text-muted-foreground">暂无通知</p>}
        {items.map((n) => (
          <Card
            key={n.id}
            className={cn(
              'border-l-4',
              n.readAt ? 'bg-muted/40 border-l-muted' : 'bg-card border-l-gov-blue',
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {n.title}
                    {!n.readAt && <Badge variant="secondary">未读</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <div className="text-xs text-muted-foreground">
                    {n.createdAt.toLocaleString('zh-CN')}
                  </div>
                </div>
                {n.refType === 'Case' && n.refId && (
                  <Link href={`/cases/${n.refId}`} className="text-gov-blue text-xs whitespace-nowrap">
                    查看案件 →
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
