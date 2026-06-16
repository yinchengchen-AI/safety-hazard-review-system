import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { TodoList } from '@/components/workbench/todo-list';
import { QuickActions } from '@/components/workbench/quick-actions';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';

export default async function Dashboard() {
  const session = await auth();
  if (!session) redirect('/login');
  const { role, id } = session.user;
  const kpi = await StatsService.kpi();

  let todos: { id: string; title: string; href: string }[] = [];
  if (role === 'INSPECTOR') {
    const myCases = await prisma.case.findMany({
      where: { registeredById: id, status: { in: ['PENDING_REVIEW', 'PENDING_AUDIT', 'IN_AUDIT'] } },
      take: 10,
      orderBy: { registeredAt: 'desc' },
    });
    todos = myCases.map((c) => ({ id: c.id, title: c.code, href: `/cases/${c.id}` }));
  } else if (role === 'CHIEF') {
    const pendingAudits = await prisma.case.findMany({
      where: { status: { in: ['PENDING_AUDIT', 'IN_AUDIT'] } },
      take: 10,
      orderBy: { registeredAt: 'asc' },
    });
    todos = pendingAudits.map((c) => ({ id: c.id, title: c.code, href: `/cases/${c.id}/audit` }));
  }

  return (
    <PageShell
      title="工作台"
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/cases/import">
              <Upload className="mr-2 h-4 w-4" /> 批量导入
            </Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">
              <Plus className="mr-2 h-4 w-4" /> 登记案件
            </Link>
          </Button>
        </>
      }
    >
      <KpiCards kpi={kpi} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TodoList items={todos} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
      </div>
    </PageShell>
  );
}
