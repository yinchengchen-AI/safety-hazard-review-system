import { auth } from '@/lib/auth';
import { SyncService } from '@/services/sync';
import { Badge } from '@/components/ui/badge';

export default async function SyncStatusPage() {
  const session = await auth();
  if (!session) return null;
  const items = await SyncService.listPending(session.user.id);
  return (
    <main className="p-6 max-w-2xl space-y-2">
      <h1 className="text-2xl font-semibold mb-4">我的同步</h1>
      {items.length === 0 && <p className="text-sm text-muted-foreground">没有待同步项</p>}
      {items.map((q) => (
        <div key={q.id} className="border rounded p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-mono">{q.opType}</span>
            <Badge variant={q.status === 'FAILED' ? 'destructive' : 'secondary'}>{q.status}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">{q.errorMsg || '—'}</p>
        </div>
      ))}
    </main>
  );
}
