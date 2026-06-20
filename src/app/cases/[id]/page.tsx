import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatusBadge, SeverityBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseTimeline } from '@/components/case/case-timeline';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const c = await prisma.case.findUnique({
    where: { id },
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

  // IN_AUDIT 但被其他人领取时，给个禁用的占位按钮，避免空 Link 点击后被服务端打回
  const currentUserId = session?.user?.id;
  const lockedByOther =
    c.status === 'IN_AUDIT' && !!c.lockedById && c.lockedById !== currentUserId;
  const actionButton =
    c.status === 'PENDING_REVIEW' ? (
      <Button asChild>
        <Link href={`/cases/${c.id}/review`}>开始复核</Link>
      </Button>
    ) : lockedByOther ? (
      <Button variant="secondary" disabled title={`已被 ${c.lockedBy?.name ?? c.lockedById} 领取`}>
        已被 {c.lockedBy?.name ?? c.lockedById} 领取
      </Button>
    ) : c.status === 'PENDING_AUDIT' || c.status === 'IN_AUDIT' ? (
      <Button asChild>
        <Link href={`/cases/${c.id}/audit`}>审核</Link>
      </Button>
    ) : null;

  return (
    <PageShell
      title={c.code}
      actions={
        <>
          <StatusBadge status={c.status} />
          <SeverityBadge severity={c.severity} />
          {actionButton}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-muted-foreground">企业：</span> {c.enterprise.name}
              </div>
              <div>
                <span className="text-muted-foreground">隐患类型：</span> {c.hazardType.name}
              </div>
              <div>
                <span className="text-muted-foreground">严重程度：</span> {c.severity}
              </div>
              <div>
                <span className="text-muted-foreground">来源：</span> {c.source}
              </div>
              <div>
                <span className="text-muted-foreground">登记人：</span> {c.registeredBy.name}
              </div>
              <div>
                <span className="text-muted-foreground">整改期限：</span>{' '}
                {c.deadline.toLocaleDateString('zh-CN')}
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">地址：</span> {c.address || '-'}
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">描述：</span> {c.description}
              </div>
            </CardContent>
          </Card>

          <CaseTimeline reviews={c.reviews} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">案件状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前状态</span>
                <span>{STATUS_LABEL[c.status] ?? c.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前处理人</span>
                <span>{c.lockedBy?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">距整改期限</span>
                <span className="text-amber-600">
                  {Math.ceil((c.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">附件照片</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                整改前
              </div>
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                整改后
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
