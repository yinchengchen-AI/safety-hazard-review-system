import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StatsService } from '@/services/stats';
import { handleError, problem } from '@/lib/api-error';

export async function GET() {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    return NextResponse.json(await StatsService.kpi());
  } catch (e) {
    return handleError(e);
  }
}
