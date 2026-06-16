import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, problem } from '../../_lib/error';

const Schema = z.object({ clientId: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const { clientId } = Schema.parse(await req.json());
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'SYNC_FAILED',
        title: '同步失败',
        body: `操作 ${clientId} 重试 3 次仍失败，请检查网络后到「我的同步」页手动重试。`,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
