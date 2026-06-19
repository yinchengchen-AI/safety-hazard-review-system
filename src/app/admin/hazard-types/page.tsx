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
import { Badge } from '@/components/ui/badge';

export default async function AdminHazardTypesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  try {
    assertCan(session.user.role, 'admin:hazard-types');
  } catch {
    return <p>无权限</p>;
  }
  const list = await prisma.hazardType.findMany({ orderBy: { sortOrder: 'asc' } });
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">隐患类型</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>编码</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>排序</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-mono text-xs">{h.code}</TableCell>
              <TableCell>{h.name}</TableCell>
              <TableCell>{h.category}</TableCell>
              <TableCell>{h.sortOrder}</TableCell>
              <TableCell>
                <Badge variant={h.active ? 'default' : 'secondary'}>
                  {h.active ? '启用' : '停用'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
