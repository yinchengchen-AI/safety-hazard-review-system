import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { ReviewService } from '@/services/review';
import { handleError, problem } from '../../../_lib/error';

const ClaimSchema = z.object({ action: z.enum(['claim', 'takeover']) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const body = ClaimSchema.parse(await req.json());
    if (body.action === 'claim') {
      assertCan(session.user.role, 'review:claim');
      const r = await ReviewService.claim(params.id, session.user.id);
      return NextResponse.json(r);
    } else {
      assertCan(session.user.role, 'review:takeover');
      const r = await ReviewService.takeOver(params.id, session.user.id);
      return NextResponse.json(r);
    }
  } catch (e) {
    return handleError(e);
  }
}

const SubmitSchema = z.object({
  conclusion: z.enum(['PASS', 'FAIL', 'PARTIAL']),
  summary: z.string().min(1),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'review:submit');
    const body = SubmitSchema.parse(await req.json());
    const r = await ReviewService.submit(params.id, body.conclusion, body.summary, session.user.id);
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}
