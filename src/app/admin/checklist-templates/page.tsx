import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';

export default async function AdminTemplatesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  try {
    assertCan(session.user.role, 'admin:templates');
  } catch {
    return <p>无权限</p>;
  }
  const list = await prisma.checklistTemplate.findMany({
    where: { active: true },
    include: { hazardType: true, items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">检查清单模板</h1>
      {list.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="font-medium">{t.name} <span className="text-sm text-muted-foreground">({t.hazardType.name})</span></div>
          <ul className="mt-2 space-y-1 text-sm">
            {t.items.map((it) => (
              <li key={it.id} className="flex gap-2">
                <span className="text-muted-foreground w-8">{it.sortOrder}.</span>
                <span>{it.content}</span>
                {it.required && <span className="text-red-500">*</span>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </main>
  );
}
