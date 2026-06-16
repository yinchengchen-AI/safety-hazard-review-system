import { prisma } from '@/lib/prisma';
import type { NotificationType, Notification } from '@prisma/client';

export const NotificationService = {
  async create(
    userId: string,
    type: NotificationType,
    opts: { refType?: string; refId?: string; title: string; body: string },
  ): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId,
        type,
        refType: opts.refType,
        refId: opts.refId,
        title: opts.title,
        body: opts.body,
      },
    });
  },

  /**
   * 给"所有科长"群发（v0.1 单局简化）
   */
  async broadcastToChiefs(
    type: NotificationType,
    opts: { refType?: string; refId?: string; title: string; body: string },
  ) {
    const chiefs = await prisma.user.findMany({
      where: { role: 'CHIEF', status: 'ACTIVE' },
      select: { id: true },
    });
    if (chiefs.length === 0) return [];
    return prisma.notification.createMany({
      data: chiefs.map((c) => ({
        userId: c.id,
        type,
        refType: opts.refType,
        refId: opts.refId,
        title: opts.title,
        body: opts.body,
      })),
    });
  },

  async list(userId: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  },

  async markRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  },
};
