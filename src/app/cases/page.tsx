import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CasesTable } from '@/components/case/cases-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) return null;
  const where = sp.status ? { status: sp.status as never } : {};
  const cases = await prisma.case.findMany({
    where,
    orderBy: { registeredAt: 'desc' },
    take: 50,
    include: { enterprise: true, hazardType: true, registeredBy: { select: { name: true } } },
  });
  return (
    <main className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">案件列表</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/cases/import">批量导入</Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">登记案件</Link>
          </Button>
        </div>
      </div>
      <CasesTable cases={cases} />
    </main>
  );
}
