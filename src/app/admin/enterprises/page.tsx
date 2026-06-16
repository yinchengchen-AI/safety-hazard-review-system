import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminEnterprisesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  try {
    assertCan(session.user.role, 'admin:enterprises');
  } catch {
    return <p>无权限</p>;
  }
  const list = await prisma.enterprise.findMany({ orderBy: { name: 'asc' } });
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">企业管理</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>统一社会信用代码</TableHead>
            <TableHead>行业</TableHead>
            <TableHead>地址</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.name}</TableCell>
              <TableCell className="font-mono text-xs">{e.unifiedSocialCreditId}</TableCell>
              <TableCell>{e.industry}</TableCell>
              <TableCell>{e.address}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
