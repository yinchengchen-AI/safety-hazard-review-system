import { prisma } from '@/lib/prisma';
import { ReviewService } from './review';
import type { PhotoMeta } from './photo';
import { BusinessError } from '@/lib/errors';

export const SyncService = {
  /**
   * 客户端联网后推送操作 — 用 clientId 做幂等
   */
  async enqueue(
    userId: string,
    clientId: string,
    opType: string,
    payload: Record<string, unknown>,
  ) {
    return prisma.offlineSyncQueue.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, opType, payload: payload as never, status: 'PENDING' },
      update: {},
    });
  },

  /**
   * 处理一个 pending 操作
   */
  async processOne(queueId: string) {
    return prisma.$transaction(async (tx) => {
      const q = await tx.offlineSyncQueue.findUnique({ where: { id: queueId } });
      if (!q || q.status !== 'PENDING') return null;
      try {
        switch (q.opType) {
          case 'submit_review': {
            const p = (q.payload ?? {}) as Record<string, unknown>;
            const photos = Array.isArray(p['photos']) ? (p['photos'] as PhotoMeta[]) : [];
            await ReviewService.submit(
              p['caseId'] as string,
              p['conclusion'] as 'PASS' | 'FAIL' | 'PARTIAL',
              (p['summary'] as string) ?? '',
              q.userId,
              photos,
            );
            break;
          }
          default:
            throw new BusinessError('unknown_op', `Unknown opType: ${q.opType}`, 400);
        }
        await tx.offlineSyncQueue.update({
          where: { id: q.id },
          data: { status: 'SYNCED', syncedAt: new Date() },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // 这次更新后 retryCount 达到 3 → 标 FAILED（spec §5.6 兜底通知）
        const willFail = q.retryCount + 1 >= 3;
        await tx.offlineSyncQueue.update({
          where: { id: q.id },
          data: {
            status: willFail ? 'FAILED' : 'PENDING',
            retryCount: { increment: 1 },
            errorMsg: message,
          },
        });
        if (willFail) {
          await tx.notification.create({
            data: {
              userId: q.userId,
              type: 'SYNC_FAILED',
              refType: 'OfflineSyncQueue',
              refId: q.id,
              title: '离线同步失败',
              body: `操作 ${q.opType} 重试 3 次仍失败：${message}`,
            },
          });
        }
        throw e;
      }
    });
  },

  async listPending(userId: string) {
    return prisma.offlineSyncQueue.findMany({
      where: { userId, status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
    });
  },
};
