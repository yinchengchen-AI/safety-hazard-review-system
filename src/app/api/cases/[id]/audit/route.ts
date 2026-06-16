import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { AuditService } from '@/services/audit';
import { NotificationService } from '@/services/notification';
import { prisma } from '@/lib/prisma';
import { handleError, problem } from '../../../_lib/error';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'audit:open');
    const c = await AuditService.openAudit(params.id, session.user.id);
    return NextResponse.json(c);
  } catch (e) {
    return handleError(e);
  }
}

const SignSchema = z.object({ signatureUrl: z.string().url(), comment: z.string().optional() });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('action') === 'reject') {
      assertCan(session.user.role, 'audit:reject');
      const { reason } = z.object({ reason: z.string().min(1) }).parse(await req.json());
      const c = await AuditService.reject(params.id, session.user.id, reason);
      const full = await prisma.case.findUnique({ where: { id: params.id } });
      if (full) {
        await NotificationService.create(full.registeredById, 'AUDIT_RESULT', {
          refType: 'Case',
          refId: params.id,
          title: `案件 ${full.code} 已被驳回`,
          body: `理由：${reason}`,
        });
      }
      return NextResponse.json(c);
    } else {
      assertCan(session.user.role, 'audit:sign');
      const body = SignSchema.parse(await req.json());
      const c = await AuditService.sign(params.id, session.user.id, body.signatureUrl, body.comment);
      const full = await prisma.case.findUnique({ where: { id: params.id } });
      if (full) {
        await NotificationService.create(full.registeredById, 'AUDIT_RESULT', {
          refType: 'Case',
          refId: params.id,
          title: `案件 ${full.code} 已销案`,
          body: body.comment || '审核通过',
        });
      }
      return NextResponse.json(c);
    }
  } catch (e) {
    return handleError(e);
  }
}
