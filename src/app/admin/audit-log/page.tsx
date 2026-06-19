import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AdminAuditLogPage() {
  const session = await auth();
  if (!session) redirect('/login');
  try {
    assertCan(session.user.role, 'audit-log:view');
  } catch {
    return <p>无权限</p>;
  }
  const list = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true } } },
  });
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">审计日志</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>目标</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.createdAt.toLocaleString('zh-CN')}</TableCell>
              <TableCell>{a.user.name}</TableCell>
              <TableCell className="font-mono text-xs">{a.action}</TableCell>
              <TableCell className="font-mono text-xs">
                {a.targetType}:{a.targetId}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
