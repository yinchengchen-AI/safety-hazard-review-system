import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

export default async function CaseDetail({ params }: { params: { id: string } }) {
  await auth();
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      enterprise: true,
      hazardType: true,
      registeredBy: { select: { name: true } },
      lockedBy: { select: { name: true } },
      reviews: {
        orderBy: { startedAt: 'desc' },
        include: {
          reviewer: { select: { name: true } },
          items: { include: { item: true } },
        },
      },
      auditSignatures: {
        orderBy: { signedAt: 'desc' },
        include: { auditor: { select: { name: true } } },
      },
    },
  });
  if (!c) return <p>案件不存在</p>;
  return (
    <main className="p-6 space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-mono">{c.code}</h1>
        <Badge>{STATUS_LABEL[c.status] ?? c.status}</Badge>
      </div>
      <section className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">企业：</span>{c.enterprise.name}</div>
        <div><span className="text-muted-foreground">隐患类型：</span>{c.hazardType.name}</div>
        <div><span className="text-muted-foreground">严重程度：</span>{c.severity}</div>
        <div><span className="text-muted-foreground">来源：</span>{c.source}</div>
        <div><span className="text-muted-foreground">地址：</span>{c.address || '-'}</div>
        <div><span className="text-muted-foreground">整改期限：</span>{c.deadline.toLocaleDateString('zh-CN')}</div>
        <div className="col-span-2"><span className="text-muted-foreground">描述：</span>{c.description}</div>
      </section>
      <div className="flex gap-2">
        {c.status === 'PENDING_REVIEW' && (
          <Button asChild>
            <Link href={`/cases/${c.id}/review`}>开始复核</Link>
          </Button>
        )}
        {(c.status === 'PENDING_AUDIT' || c.status === 'IN_AUDIT') && (
          <Button asChild>
            <Link href={`/cases/${c.id}/audit`}>审核</Link>
          </Button>
        )}
      </div>
      <section>
        <h2 className="text-lg font-medium mb-2">复核历史</h2>
        {c.reviews.length === 0 && <p className="text-sm text-muted-foreground">暂无复核记录</p>}
        {c.reviews.map((r) => (
          <div key={r.id} className="border rounded p-3 mb-2 text-sm">
            <div>状态：{r.status} | 复核人：{r.reviewer.name} | 提交时间：{r.submittedAt?.toLocaleString('zh-CN') || '未提交'}</div>
            {r.conclusion && <div>结论：{r.conclusion} | 摘要：{r.summary}</div>}
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">签字记录</h2>
        {c.auditSignatures.length === 0 && <p className="text-sm text-muted-foreground">暂无签字</p>}
        {c.auditSignatures.map((s) => (
          <div key={s.id} className="border rounded p-3 mb-2 text-sm">
            {s.auditor.name} {s.decision === 'PASS' ? '通过' : '驳回'} — {s.signedAt.toLocaleString('zh-CN')}
            {s.comment && <div className="text-muted-foreground">{s.comment}</div>}
          </div>
        ))}
      </section>
    </main>
  );
}
