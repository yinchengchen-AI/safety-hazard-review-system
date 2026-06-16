import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { TodoList } from '@/components/workbench/todo-list';
import { Card } from '@/components/ui/card';

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
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">工作台</h1>
      <KpiCards kpi={kpi} />
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">待办</h2>
        <TodoList items={todos} />
      </Card>
    </main>
  );
}
