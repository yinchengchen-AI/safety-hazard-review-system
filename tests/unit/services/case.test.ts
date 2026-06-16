import { describe, it, expect, vi } from 'vitest';
import { CaseService } from '@/services/case';

const createCase = vi.fn().mockResolvedValue({ id: 'c1', code: 'CASE-1', status: 'PENDING_REVIEW' });
const updateCase = vi.fn().mockResolvedValue({ id: 'c1', status: 'PENDING_AUDIT' });
const findCase = vi.fn().mockResolvedValue({ id: 'c1', status: 'PENDING_REVIEW' });
const findFirstCase = vi.fn().mockResolvedValue(null);
const reviewCreate = vi.fn();
const auditCreate = vi.fn();
const tx = {
  case: { create: createCase, update: updateCase, findUnique: findCase, findFirst: findFirstCase },
  review: { create: reviewCreate },
  auditLog: { create: auditCreate },
};
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

describe('CaseService', () => {
  it('register creates case with PENDING_REVIEW + empty review', async () => {
    const c = await CaseService.register(
      {
        enterpriseId: 'e1',
        hazardTypeId: 'h1',
        severity: 'MAJOR',
        source: '监管检查',
        description: 'desc',
        address: 'addr',
        deadline: new Date(),
        templateId: 't1',
        reviewerId: 'u1',
      },
      'u1',
    );
    expect(c.status).toBe('PENDING_REVIEW');
    expect(createCase).toHaveBeenCalled();
    expect(reviewCreate).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });
});
