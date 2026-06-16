import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PhotoService } from '@/services/photo';
import { problem } from '@/lib/api-error';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  const url = await PhotoService.getSignedUrl(key);
  return NextResponse.redirect(url);
}
