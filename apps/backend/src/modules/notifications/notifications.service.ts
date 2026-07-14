import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'task_created'
  | 'task_completed'
  | 'task_cancelled'
  | 'hazard_reviewed'
  | 'report_completed';

export interface NotifyOptions {
  related?: { type?: string; id?: string };
  /** When true, bypass the (user_id, type, related_id) dedup so
   *  a repeated event (e.g. a re-completed report) can still
   *  notify. Defaults to false. */
  force?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAdminUserIds(): Promise<string[]> {
    const rows = await this.prisma.users.findMany({
      where: { role: 'admin', is_active: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async list(userId: string, page: number, pageSize: number): Promise<{ items: any[]; total: number; unread_count: number }> {
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
    const n = await this.prisma.notifications.findFirst({ where: { id: notificationId } });
    if (!n) {
      throw new NotFoundException('通知不存在');
    }
    if (n.user_id !== userId) {
      throw new ForbiddenException('无权操作该通知');
    }
    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }

  /**
   * Insert one notification per recipient. When ``related.id`` is
   * provided AND ``force`` is false, an in-app dedup check
   * suppresses repeat rows for the same (user, type, related_id)
   * triple. Pass ``force: true`` to bypass the dedup (the report
   * processor uses this so a re-completed report can still
   * notify), or omit ``related.id`` to disable dedup at the DB
   * level (the partial unique index only fires on non-null ids).
   */
  async notify(
    type: NotificationType,
    title: string,
    candidateUserIds: string[],
    options: NotifyOptions | { type?: string; id?: string } = {},
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    try {
      const db = client ?? this.prisma;
      const related = 'related' in options ? options.related : (options as { type?: string; id?: string });
      const force = (options as NotifyOptions).force === true;
      const recipients = Array.from(new Set(candidateUserIds.filter(Boolean)));
      if (recipients.length === 0) return 0;
      let targets = recipients;
      if (!force && related?.id) {
        const existing = await db.notifications.findMany({
          where: { user_id: { in: recipients }, type, related_id: related.id },
          select: { user_id: true },
        });
        const already = new Set(existing.map((n) => n.user_id));
        targets = recipients.filter((id) => !already.has(id));
        if (targets.length === 0) return 0;
      }
      await db.notifications.createMany({
        data: targets.map((user_id) => ({
          user_id,
          type,
          title,
          is_read: false,
          related_type: related?.type ?? null,
          related_id: related?.id ?? null,
        })),
      });
      return targets.length;
    } catch (err) {
      this.logger.warn(
        `notify(${type}, related=${(options as { related?: { id?: string } }).related?.id ?? '-'}) failed: ${(err as Error).message}`,
      );
      return 0;
    }
  }
}
