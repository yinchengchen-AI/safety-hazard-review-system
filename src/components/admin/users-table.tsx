import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const ROLE_LABEL: Record<string, string> = {
  INSPECTOR: '监管员',
  CHIEF: '科长',
  DIRECTOR: '局长',
  ADMIN: '管理员',
};

type Row = { id: string; name: string; email: string; role: string; status: string };

export function UsersTable({ users }: { users: Row[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>姓名</TableHead>
          <TableHead>邮箱</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell><Badge>{ROLE_LABEL[u.role] ?? u.role}</Badge></TableCell>
            <TableCell>{u.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
