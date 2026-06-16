import { Prisma } from '@prisma/client';

export async function generateCaseCode(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `${y}${m}${d}`;
  // 简单 seq：当天最大编号 + 1（生产可换 sequence）
  const latest = await tx.case.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
  });
  const seq = latest ? String(Number(latest.code.slice(-4)) + 1).padStart(4, '0') : '0001';
  return `${prefix}-${seq}`;
}
