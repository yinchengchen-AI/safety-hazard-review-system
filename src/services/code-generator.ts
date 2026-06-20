import { Prisma } from '@prisma/client';

// Generate YYYYMMDD-NNNN case codes. We serialize concurrent calls for the same
// date with a Postgres transaction-level advisory lock so the read-then-write
// is atomic without needing a separate sequence table.
export async function generateCaseCode(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `${y}${m}${d}`;
  // Date as a single bigint key, kept under 2^63 since the ymd product fits.
  const lockKey = Number(prefix);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
  const latest = await tx.case.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
  });
  const seq = latest ? Number(latest.code.slice(-4)) + 1 : 1;
  if (seq > 9999) {
    throw new Error(`Daily case code limit exceeded for ${prefix}`);
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}
