import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StatsService } from '@/services/stats';
import { handleError, problem } from '../../_lib/error';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const days = Number(req.nextUrl.searchParams.get('days') || 30);
    return NextResponse.json(await StatsService.trend(days));
  } catch (e) {
    return handleError(e);
  }
}
