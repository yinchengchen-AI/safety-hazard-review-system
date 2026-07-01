import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page: number, pageSize: number) {
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notifications.count({ where: { user_id: userId } }),
      this.prisma.notifications.count({
        where: { user_id: userId, is_read: false },
      }),
    ]);
    return { items, total, unread_count: unreadCount };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notifications.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date(), updated_at: new Date() },
    });
    if (result.count === 0) {
      throw new Error('Notification not found');
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date(), updated_at: new Date() },
    });
  }

  /**
   * Insert one notification per recipient, deduped by the unique
   * (user_id, type, related_id) index. The pre-filter SELECT means
   * we rarely have to swallow IntegrityError — the row is simply
   * skipped when an existing notification is found.
   */
  async notify(
    type: 'task_created' | 'task_completed' | 'task_cancelled' | 'hazard_reviewed' | 'report_completed',
    title: string,
    candidateUserIds: string[],
    related?: { type?: string; id?: string },
  ): Promise<number> {
    if (candidateUserIds.length === 0) return 0;
    if (related?.id) {
      const existing = await this.prisma.notifications.findMany({
        where: {
          user_id: { in: candidateUserIds },
          type,
          related_id: related.id,
        },
        select: { user_id: true },
      });
      const already = new Set(existing.map((n) => n.user_id));
      candidateUserIds = candidateUserIds.filter((id) => !already.has(id));
    }
    if (candidateUserIds.length === 0) return 0;
    await this.prisma.notifications.createMany({
      data: candidateUserIds.map((user_id) => ({
        user_id,
        type,
        title,
        is_read: false,
        related_type: related?.type ?? null,
        related_id: related?.id ?? null,
      })),
    });
    return candidateUserIds.length;
  }
}
