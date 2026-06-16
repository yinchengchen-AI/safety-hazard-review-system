import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditForm } from './audit-form';
import { notFound } from 'next/navigation';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const c = await prisma.case.findUnique({
    where: { id: id },
    include: {
      reviews: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        include: { items: { include: { item: true } }, photos: true, reviewer: true },
      },
      lockedBy: { select: { name: true } },
    },
  });
  if (!c) notFound();
  return (
    <main className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold font-mono">{c.code} — 审核</h1>
      {c.lockedBy && c.status === 'IN_AUDIT' && (
        <p className="text-yellow-600 text-sm">已被 {c.lockedBy.name} 领取</p>
      )}
      <AuditForm
        caseId={c.id}
        status={c.status}
        lockedByMe={c.lockedById === session?.user.id}
        review={c.reviews[0]}
      />
    </main>
  );
}
