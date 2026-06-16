import { NextResponse } from 'next/server';
import { BusinessError } from '@/lib/errors';

type ZodLike = {
  issues: { path: (string | number)[]; message: string }[];
};

export function handleError(e: unknown): NextResponse {
  if (e instanceof BusinessError) {
    return problem(e.httpStatus, e.code, e.message);
  }
  if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ZodError') {
    const zod = e as unknown as ZodLike;
    const message = zod.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return problem(400, 'validation_error', message);
  }
  console.error('[api] unhandled error:', e);
  const message = e instanceof Error ? e.message : String(e);
  return problem(500, 'internal_error', message);
}

export function problem(status: number, code: string, message: string): NextResponse {
  return new NextResponse(JSON.stringify({ code, message }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
