import { describe, it, expect, beforeEach, vi } from 'vitest';

const registerSpy = vi.fn();
vi.mock('@/services/case', () => ({
  CaseService: { register: (...args: unknown[]) => registerSpy(...args) },
}));

function buildPrisma() {
  return {
    enterprise: { upsert: vi.fn() },
    hazardType: { findUnique: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    importError: { create: vi.fn() },
    importBatch: { update: vi.fn() },
  };
}

describe('ImportService.commit', () => {
  let m: ReturnType<typeof buildPrisma>;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m = buildPrisma();
    vi.doMock('@/lib/prisma', () => ({ prisma: m }));
  });

  const baseRow = {
    name: '企业A',
    unifiedSocialCreditId: '91110000XXXXXX0001',
    hazardTypeCode: 'FIRE',
    severity: 'MAJOR' as const,
    source: '监管检查',
    description: 'desc',
    address: 'addr',
    deadline: new Date('2026-12-31'),
  };

  it('upserts enterprise + looks up hazard + template + registers a case', async () => {
    m.enterprise.upsert.mockResolvedValueOnce({ id: 'e1' });
    m.hazardType.findUnique.mockResolvedValueOnce({ id: 'h1' });
    m.checklistTemplate.findFirst.mockResolvedValueOnce({ id: 't1' });
    registerSpy.mockResolvedValueOnce({});
    m.importBatch.update.mockResolvedValueOnce({});

    const { ImportService } = await import('@/services/import');
    const r = await ImportService.commit([baseRow], 'batch-1', 'u1');
    expect(r).toEqual({ success: 1, failed: 0 });
    expect(registerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enterpriseId: 'e1',
        hazardTypeId: 'h1',
        templateId: 't1',
        reviewerId: 'u1',
      }),
      'u1',
    );
    expect(m.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { successCount: 1, failedCount: 0, status: 'completed' },
    });
  });

  it('marks partial when any row fails and writes an ImportError', async () => {
    m.enterprise.upsert.mockResolvedValueOnce({ id: 'e1' });
    m.hazardType.findUnique.mockResolvedValueOnce({ id: 'h1' });
    m.checklistTemplate.findFirst.mockResolvedValueOnce({ id: 't1' });
    registerSpy.mockResolvedValueOnce({});
    // second row: unknown hazard code
    m.enterprise.upsert.mockResolvedValueOnce({ id: 'e2' });
    m.hazardType.findUnique.mockResolvedValueOnce(null);
    m.importError.create.mockResolvedValueOnce({});
    m.importBatch.update.mockResolvedValueOnce({});

    const { ImportService } = await import('@/services/import');
    const r = await ImportService.commit(
      [baseRow, { ...baseRow, hazardTypeCode: 'NOPE', unifiedSocialCreditId: '91110000XXXXXX0002' }],
      'batch-2',
      'u1',
    );
    expect(r).toEqual({ success: 1, failed: 1 });
    expect(m.importError.create).toHaveBeenCalledWith({
      data: { batchId: 'batch-2', rowNumber: 2, field: 'row', message: expect.stringContaining('NOPE') },
    });
    expect(m.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-2' },
      data: { successCount: 1, failedCount: 1, status: 'partial' },
    });
  });

  it('marks partial when no active template exists for the hazard type', async () => {
    m.enterprise.upsert.mockResolvedValueOnce({ id: 'e1' });
    m.hazardType.findUnique.mockResolvedValueOnce({ id: 'h1' });
    m.checklistTemplate.findFirst.mockResolvedValueOnce(null);
    m.importError.create.mockResolvedValueOnce({});
    m.importBatch.update.mockResolvedValueOnce({});

    const { ImportService } = await import('@/services/import');
    const r = await ImportService.commit([baseRow], 'batch-3', 'u1');
    expect(r).toEqual({ success: 0, failed: 1 });
    expect(m.importError.create).toHaveBeenCalled();
    expect(m.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-3' },
      data: { successCount: 0, failedCount: 1, status: 'partial' },
    });
  });
});
