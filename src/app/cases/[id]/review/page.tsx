import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReviewForm } from './review-form';
import { notFound } from 'next/navigation';

export default async function ReviewPage({ params }: { params: { id: string } }) {
  await auth();
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      reviews: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        include: { items: true, photos: true },
      },
    },
  });
  if (!c) notFound();
  const review = c.reviews[0];
  if (!review) return <p>无复核记录</p>;

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: review.templateId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!template) return <p>模板不存在</p>;

  return (
    <main className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold font-mono">{c.code} — 复核</h1>
      <ReviewForm caseId={c.id} reviewId={review.id} template={template} review={review} />
    </main>
  );
}
