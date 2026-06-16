import { auth } from '@/lib/auth';
import { SyncService } from '@/services/sync';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default async function SyncStatusPage() {
  const session = await auth();
  if (!session) return null;
  const items = await SyncService.listPending(session.user.id);
  const pending = items.filter((q) => q.status === 'PENDING').length;
  const failed = items.filter((q) => q.status === 'FAILED').length;
  const synced = 0;

  return (
    <PageShell title="离线同步">
      <div className="grid gap-4 md:grid-cols-3 max-w-3xl">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{synced}</div>
              <div className="text-xs text-muted-foreground">已同步</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{pending}</div>
              <div className="text-xs text-muted-foreground">待同步</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <div className="text-2xl font-bold">{failed}</div>
              <div className="text-xs text-muted-foreground">失败</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">同步队列</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">没有待同步项</p>}
          {items.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-mono">{q.opType}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{q.errorMsg || '—'}</span>
                <Badge variant={q.status === 'FAILED' ? 'destructive' : 'secondary'}>{q.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
