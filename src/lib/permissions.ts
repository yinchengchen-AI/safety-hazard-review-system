import type { UserRole } from '@prisma/client';

export type Action =
  | 'case:register'
  | 'case:list'
  | 'case:view'
  | 'review:claim'
  | 'review:submit'
  | 'review:takeover'
  | 'audit:open'
  | 'audit:sign'
  | 'audit:reject'
  | 'import:run'
  | 'stats:view'
  | 'admin:enterprises'
  | 'admin:hazard-types'
  | 'admin:templates'
  | 'user:manage'
  | 'audit-log:view'
  | 'import-batches:view';

const MATRIX: Record<UserRole, Set<Action>> = {
  INSPECTOR: new Set([
    'case:register',
    'case:list',
    'case:view',
    'review:claim',
    'review:submit',
    'review:takeover',
    'import:run',
    'stats:view',
  ]),
  CHIEF: new Set([
    'case:list',
    'case:view',
    'audit:open',
    'audit:sign',
    'audit:reject',
    'stats:view',
    'audit-log:view',
  ]),
  DIRECTOR: new Set(['case:list', 'case:view', 'stats:view', 'audit-log:view']),
  ADMIN: new Set([
    'case:list',
    'case:view',
    'admin:enterprises',
    'admin:hazard-types',
    'admin:templates',
    'user:manage',
    'audit-log:view',
    'import-batches:view',
    'stats:view',
  ]),
};

export function can(role: UserRole, action: Action): boolean {
  return MATRIX[role]?.has(action) ?? false;
}

export function assertCan(role: UserRole, action: Action): void {
  if (!can(role, action)) {
    const err = new Error(`Forbidden: role ${role} cannot ${action}`);
    (err as Error & { code: string; httpStatus: number }).code = 'forbidden';
    (err as Error & { code: string; httpStatus: number }).httpStatus = 403;
    throw err;
  }
}
