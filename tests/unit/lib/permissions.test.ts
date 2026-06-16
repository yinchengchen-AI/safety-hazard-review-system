import { describe, it, expect } from 'vitest';
import { can } from '@/lib/permissions';

describe('permissions', () => {
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
});
