import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StatsService } from '@/services/stats';
import { handleError, problem } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const by = (req.nextUrl.searchParams.get('by') || 'hazardType') as 'hazardType' | 'enterprise' | 'severity';
    return NextResponse.json(await StatsService.distribution(by));
  } catch (e) {
    return handleError(e);
  }
}
