import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const ROLE_LABEL: Record<string, string> = {
  INSPECTOR: '监管员',
  CHIEF: '科长',
  DIRECTOR: '局长',
  ADMIN: '管理员',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 hover:bg-green-100',
  INACTIVE: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
};

type Row = { id: string; name: string; email: string; role: string; status: string };

export function UsersTable({ users }: { users: Row[] }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
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
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_STYLES[u.status] ?? ''}>
                  {u.status === 'ACTIVE' ? '启用' : '禁用'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
