import { describe, it, expect } from 'vitest';
import { can, assertCan } from '@/lib/permissions';

describe('permissions.can', () => {
  it('inspector can register case', () => {
    expect(can('INSPECTOR', 'case:register')).toBe(true);
  });

  it('inspector cannot audit case', () => {
    expect(can('INSPECTOR', 'audit:sign')).toBe(false);
  });

  it('chief can audit case', () => {
    expect(can('CHIEF', 'audit:sign')).toBe(true);
  });

  it('chief cannot manage users', () => {
    expect(can('CHIEF', 'user:manage')).toBe(false);
  });

  it('admin can manage users and templates', () => {
    expect(can('ADMIN', 'user:manage')).toBe(true);
    expect(can('ADMIN', 'admin:templates')).toBe(true);
  });

  it('admin cannot audit (chief responsibility)', () => {
    expect(can('ADMIN', 'audit:sign')).toBe(false);
  });

  it('director can view stats but not write cases', () => {
    expect(can('DIRECTOR', 'stats:view')).toBe(true);
    expect(can('DIRECTOR', 'case:register')).toBe(false);
  });

  it('inspector can import and view their own stats', () => {
    expect(can('INSPECTOR', 'import:run')).toBe(true);
    expect(can('INSPECTOR', 'stats:view')).toBe(true);
  });

  it('director can view audit log and lists, but not reject', () => {
    expect(can('DIRECTOR', 'audit-log:view')).toBe(true);
    expect(can('DIRECTOR', 'case:list')).toBe(true);
    expect(can('DIRECTOR', 'audit:reject')).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(can('GHOST' as never, 'case:list')).toBe(false);
  });
});

describe('permissions.assertCan', () => {
  it('returns void when allowed', () => {
    expect(() => assertCan('INSPECTOR', 'case:register')).not.toThrow();
  });

  it('throws 403 with code=forbidden when not allowed', () => {
    try {
      assertCan('INSPECTOR', 'audit:sign');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error & { code: string; httpStatus: number }).code).toBe('forbidden');
      expect((e as Error & { code: string; httpStatus: number }).httpStatus).toBe(403);
      expect((e as Error).message).toContain('INSPECTOR');
      expect((e as Error).message).toContain('audit:sign');
    }
  });
});
