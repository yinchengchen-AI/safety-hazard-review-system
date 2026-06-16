import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { minio, BUCKET } from '@/lib/minio';

export async function GET() {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (e: unknown) {
    checks.postgres = e instanceof Error ? e.message : String(e);
  }
  try {
    await minio.bucketExists(BUCKET);
    checks.minio = 'ok';
  } catch (e: unknown) {
    checks.minio = e instanceof Error ? e.message : String(e);
  }
  const ok = Object.values(checks).every((v) => v === 'ok');
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
