import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, problem } from '../../../../../_lib/error';

const Schema = z.object({
  reviewId: z.string(),
  itemId: z.string(),
  result: z.enum(['PASS', 'FAIL', 'NA']),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const body = Schema.parse(await req.json());
    await prisma.reviewItemResult.upsert({
      where: { reviewId_itemId: { reviewId: body.reviewId, itemId: body.itemId } },
      create: { reviewId: body.reviewId, itemId: body.itemId, result: body.result, note: body.note },
      update: { result: body.result, note: body.note },
    });
    await prisma.review.update({ where: { id: body.reviewId }, data: { lastActiveAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
