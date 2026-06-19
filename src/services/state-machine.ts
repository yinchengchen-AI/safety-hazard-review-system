import { CaseStatus } from '@prisma/client';
import { BusinessError } from '@/lib/errors';

export type CaseEvent = 'submit_review' | 'open_audit' | 'sign' | 'reject' | 'reclaim_idle';

// Source of truth — matches spec §4.3 transition table
export const CASE_TRANSITIONS: Record<CaseStatus, Partial<Record<CaseEvent, CaseStatus>>> = {
  PENDING_REVIEW: { submit_review: 'PENDING_AUDIT' },
  PENDING_AUDIT: { open_audit: 'IN_AUDIT' },
  IN_AUDIT: {
    sign: 'CLOSED',
    reject: 'PENDING_REVIEW',
    reclaim_idle: 'PENDING_AUDIT',
  },
  CLOSED: {},
};

export function transitionCase(from: CaseStatus, event: CaseEvent, actorId: string): CaseStatus {
  if (!actorId) throw new BusinessError('invalid_actor', 'actorId required', 400);
  const next = CASE_TRANSITIONS[from]?.[event];
  if (!next) {
    throw new BusinessError('invalid_transition', `Cannot ${event} from ${from}`, 409);
  }
  return next;
}
