import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { UsersTable } from '@/components/admin/users-table';

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
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">用户管理</h1>
      <UsersTable users={users} />
    </main>
  );
}
