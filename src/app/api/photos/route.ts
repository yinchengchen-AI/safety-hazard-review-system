import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { PhotoService } from '@/services/photo';
import { handleError, problem } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'review:submit');
    const form = await req.formData();
    const file = form.get('file') as File;
    if (!file) return problem(400, 'no_file', 'No file');
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await PhotoService.upload(buf, file.type, file.name, session.user.id);
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}
