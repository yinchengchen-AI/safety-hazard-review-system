import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-100',
  PENDING_AUDIT: 'bg-blue-100',
  IN_AUDIT: 'bg-purple-100',
  CLOSED: 'bg-green-100',
};

type Row = {
  id: string;
  code: string;
  status: string;
  registeredAt: Date;
  enterprise: { name: string };
  hazardType: { name: string };
  registeredBy: { name: string };
};

export function CasesTable({ cases }: { cases: Row[] }) {
  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无案件</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>工单号</TableHead>
          <TableHead>企业</TableHead>
          <TableHead>隐患类型</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建人</TableHead>
          <TableHead>登记时间</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-mono">{c.code}</TableCell>
            <TableCell>{c.enterprise.name}</TableCell>
            <TableCell>{c.hazardType.name}</TableCell>
            <TableCell>
              <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
            </TableCell>
            <TableCell>{c.registeredBy.name}</TableCell>
            <TableCell>{c.registeredAt.toLocaleString('zh-CN')}</TableCell>
            <TableCell>
              <Button asChild size="sm" variant="link">
                <Link href={`/cases/${c.id}`}>查看</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
