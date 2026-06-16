import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { UsersTable } from '@/components/admin/users-table';
import { PageShell } from '@/components/layout/page-shell';

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session) redirect('/login');
  try {
    assertCan(session.user.role, 'user:manage');
  } catch {
    return <p>无权限</p>;
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <PageShell title="用户管理">
      <UsersTable users={users} />
    </PageShell>
  );
}
