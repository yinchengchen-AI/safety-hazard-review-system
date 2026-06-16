import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CasesTable } from '@/components/case/cases-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { Plus, Upload } from 'lucide-react';

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
    <PageShell
      title="案件列表"
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
      <CasesTable cases={cases} />
    </PageShell>
  );
}
