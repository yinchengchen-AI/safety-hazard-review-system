import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { BusinessError } from '@/lib/errors';
import { handleError, problem } from '@/lib/api-error';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'case:view');
    const c = await prisma.case.findUnique({
      where: { id: id },
      include: {
        enterprise: true,
        hazardType: true,
        registeredBy: { select: { name: true, email: true } },
        lockedBy: { select: { name: true } },
        attachments: true,
        reviews: {
          orderBy: { startedAt: 'desc' },
          include: {
            items: { include: { item: true } },
            photos: true,
            reviewer: { select: { name: true } },
            claimedBy: { select: { name: true } },
          },
        },
        auditSignatures: {
          orderBy: { signedAt: 'desc' },
          include: { auditor: { select: { name: true } } },
        },
      },
    });
    if (!c) throw new BusinessError('not_found', 'Case not found', 404);
    return NextResponse.json(c);
  } catch (e) {
    return handleError(e);
  }
}
