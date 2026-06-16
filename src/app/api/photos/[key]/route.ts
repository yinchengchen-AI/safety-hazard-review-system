import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PhotoService } from '@/services/photo';
import { problem } from '../../../_lib/error';

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  const url = await PhotoService.getSignedUrl(params.key);
  return NextResponse.redirect(url);
}
