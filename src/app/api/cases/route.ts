import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertCan } from '@/lib/permissions';
import { CaseService } from '@/services/case';
import { prisma } from '@/lib/prisma';
import { handleError, problem } from '../_lib/error';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'case:list');
    const sp = req.nextUrl.searchParams;
    const filter = {
      status: (sp.get('status') as any) || undefined,
      hazardTypeId: sp.get('hazardTypeId') || undefined,
      enterpriseId: sp.get('enterpriseId') || undefined,
      page: Number(sp.get('page') || 1),
      pageSize: Number(sp.get('pageSize') || 20),
    };
    const result = await CaseService.list(filter);
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);
  }
}

const RegisterSchema = z.object({
  enterpriseId: z.string(),
  hazardTypeId: z.string(),
  severity: z.enum(['MAJOR', 'MODERATE', 'MINOR']),
  source: z.string().min(1),
  description: z.string().min(1),
  address: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  deadline: z.coerce.date(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    assertCan(session.user.role, 'case:register');
    const body = await req.json();
    const input = RegisterSchema.parse(body);
    const template = await prisma.checklistTemplate.findFirst({
      where: { hazardTypeId: input.hazardTypeId, active: true },
    });
    if (!template) {
      return problem(400, 'no_template', 'No active checklist template for this hazard type');
    }
    const c = await CaseService.register(
      { ...input, templateId: template.id, reviewerId: session.user.id },
      session.user.id,
    );
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
