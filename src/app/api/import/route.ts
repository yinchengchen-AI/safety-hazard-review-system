import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { ImportService } from '@/services/import';
import { prisma } from '@/lib/prisma';
import { handleError, problem } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'import:run');
    const form = await req.formData();
    const file = form.get('file') as File;
    const confirm = form.get('confirm') === 'true';
    if (!file) return problem(400, 'no_file', 'No file uploaded');

    const buf = Buffer.from(await file.arrayBuffer());

    if (!confirm) {
      const result = await ImportService.parseExcel(buf);
      return NextResponse.json({ preview: true, ...result });
    } else {
      const batch = await prisma.importBatch.create({
        data: {
          filename: file.name,
          uploadedById: session.user.id,
          totalRows: 0,
          status: 'pending',
        },
      });
      const { rows } = await ImportService.parseExcel(buf);
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { totalRows: rows.length },
      });
      const result = await ImportService.commit(rows, batch.id, session.user.id);
      return NextResponse.json({ preview: false, batchId: batch.id, ...result });
    }
  } catch (e) {
    return handleError(e);
  }
}
