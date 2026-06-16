import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification';

const SOON_DAYS = 3;

export async function scanDeadlines() {
  const now = new Date();
  const soon = new Date(now.getTime() + SOON_DAYS * 24 * 3600 * 1000);

  // 临期（未销案 + deadline 在 [now, soon] 区间 + 今天还没发过）
  const soonCases = await prisma.case.findMany({
    where: {
      status: { in: ['PENDING_REVIEW', 'PENDING_AUDIT', 'IN_AUDIT'] },
      deadline: { gte: now, lte: soon },
    },
    include: { registeredBy: true },
  });
  for (const c of soonCases) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId: c.registeredById,
        refType: 'Case',
        refId: c.id,
        type: 'DEADLINE_SOON',
        createdAt: { gte: new Date(now.toDateString()) },
      },
    });
    if (exists) continue;
    await NotificationService.create(c.registeredById, 'DEADLINE_SOON', {
      refType: 'Case',
      refId: c.id,
      title: `案件 ${c.code} 即将到期`,
      body: `整改期限：${c.deadline.toLocaleDateString('zh-CN')}`,
    });
  }

  // 超时
  const overdueCases = await prisma.case.findMany({
    where: {
      status: { in: ['PENDING_REVIEW', 'PENDING_AUDIT', 'IN_AUDIT'] },
      deadline: { lt: now },
    },
    include: { registeredBy: true },
  });
  for (const c of overdueCases) {
    await NotificationService.create(c.registeredById, 'DEADLINE_OVERDUE', {
      refType: 'Case',
      refId: c.id,
      title: `案件 ${c.code} 已超期`,
      body: `整改期限：${c.deadline.toLocaleDateString('zh-CN')}`,
    });
    await NotificationService.broadcastToChiefs('DEADLINE_OVERDUE', {
      refType: 'Case',
      refId: c.id,
      title: `案件 ${c.code} 已超期（创建人 ${c.registeredBy.name}）`,
      body: '请关注。',
    });
  }
}
