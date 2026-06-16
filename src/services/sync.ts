import { prisma } from '@/lib/prisma';
import { ReviewService } from './review';
import { BusinessError } from '@/lib/errors';

export const SyncService = {
  /**
   * 客户端联网后推送操作 — 用 clientId 做幂等
   */
  async enqueue(userId: string, clientId: string, opType: string, payload: Record<string, unknown>) {
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
            await ReviewService.submit(
              p['caseId'] as string,
              p['conclusion'] as 'PASS' | 'FAIL' | 'PARTIAL',
              (p['summary'] as string) ?? '',
              q.userId,
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
        await tx.offlineSyncQueue.update({
          where: { id: q.id },
          data: {
            status: q.retryCount >= 3 ? 'FAILED' : 'PENDING',
            retryCount: { increment: 1 },
            errorMsg: message,
          },
        });
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
