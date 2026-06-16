import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/services/notification';
import { handleError, problem } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get('page') || 1);
    const pageSize = Number(sp.get('pageSize') || 20);
    return NextResponse.json(await NotificationService.list(session.user.id, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}
