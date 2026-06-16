import { auth } from '@/lib/auth';
import { NotificationService } from '@/services/notification';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) return null;
  const { items } = await NotificationService.list(session.user.id, 1, 50);
  return (
    <main className="p-6 max-w-2xl space-y-2">
      <h1 className="text-2xl font-semibold mb-4">通知</h1>
      {items.length === 0 && <p className="text-sm text-muted-foreground">暂无通知</p>}
      {items.map((n) => (
        <div key={n.id} className="border rounded p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{n.title}</span>
            {!n.readAt && <Badge>未读</Badge>}
          </div>
          <p className="text-muted-foreground">{n.body}</p>
          {n.refType === 'Case' && n.refId && (
            <Link href={`/cases/${n.refId}`} className="text-blue-600 text-xs">查看案件 →</Link>
          )}
        </div>
      ))}
    </main>
  );
}
