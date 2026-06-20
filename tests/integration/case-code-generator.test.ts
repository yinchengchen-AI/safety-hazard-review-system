import { describe, it, expect, beforeEach, vi } from 'vitest';

// Integration test: exercise the new advisory-lock + 4-digit cap behavior of
// generateCaseCode against a mocked Prisma transaction client. This is the
// shape of code a real Postgres-backed test would have, but without needing
// testcontainers for this small change.
function buildTxMock(opts: { latestCode: string | null }) {
  const executeRaw = vi.fn().mockResolvedValue(undefined);
  const findFirst = vi.fn().mockResolvedValue(opts.latestCode ? { code: opts.latestCode } : null);
  return {
    tx: { $executeRaw: executeRaw, case: { findFirst } },
    executeRaw,
    findFirst,
  };
}

describe('generateCaseCode (integration)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('acquires a transaction-scoped advisory lock keyed by YYYYMMDD', async () => {
    const m = buildTxMock({ latestCode: null });
    const { generateCaseCode } = await import('@/services/code-generator');
    const code = await generateCaseCode(m.tx as never);

    expect(m.executeRaw).toHaveBeenCalledTimes(1);
    const sql = String(m.executeRaw.mock.calls[0][0]);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);

    const lockKey = m.executeRaw.mock.calls[0][1]?.[0] ?? m.executeRaw.mock.calls[0][1];
    expect(typeof lockKey).toBe('number');
    expect(lockKey).toBeGreaterThanOrEqual(20000101);
    expect(lockKey).toBeLessThan(30000101);

    expect(m.findFirst).toHaveBeenCalledWith({
      where: { code: { startsWith: String(lockKey) } },
      orderBy: { code: 'desc' },
    });
    expect(code).toMatch(new RegExp(`^${lockKey}-0001$`));
  });

  it('increments the suffix by 1 when the same day already has codes', async () => {
    const today = new Date();
    const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const m = buildTxMock({ latestCode: `${prefix}-0042` });
    const { generateCaseCode } = await import('@/services/code-generator');
    const code = await generateCaseCode(m.tx as never);
    expect(code).toBe(`${prefix}-0043`);
  });

  it('refuses to mint a code when the day has reached the 4-digit cap', async () => {
    const today = new Date();
    const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const m = buildTxMock({ latestCode: `${prefix}-9999` });
    const { generateCaseCode } = await import('@/services/code-generator');
    await expect(generateCaseCode(m.tx as never)).rejects.toThrow(/limit exceeded/);
  });
});
