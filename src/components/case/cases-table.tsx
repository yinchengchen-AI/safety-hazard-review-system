import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge, SeverityBadge } from '@/components/ui/status-badge';
import { ChevronRight } from 'lucide-react';

type Row = {
  id: string;
  code: string;
  status: string;
  severity: string;
  registeredAt: Date;
  enterprise: { name: string };
  hazardType: { name: string };
  registeredBy: { name: string };
};

export function CasesTable({ cases }: { cases: Row[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        暂无案件
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">工单号</TableHead>
            <TableHead>企业</TableHead>
            <TableHead>隐患类型</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>严重度</TableHead>
            <TableHead className="hidden md:table-cell">创建人</TableHead>
            <TableHead className="hidden md:table-cell">登记时间</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-gov-blue">{c.code}</TableCell>
              <TableCell className="max-w-[200px] truncate">{c.enterprise.name}</TableCell>
              <TableCell>{c.hazardType.name}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell>
                <SeverityBadge severity={c.severity} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{c.registeredBy.name}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {c.registeredAt.toLocaleString('zh-CN')}
              </TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Link href={`/cases/${c.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
