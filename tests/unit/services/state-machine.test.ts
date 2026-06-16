import { describe, it, expect } from 'vitest';
import { transitionCase, CASE_TRANSITIONS } from '@/services/state-machine';
import { BusinessError } from '@/lib/errors';

describe('state machine', () => {
  it('allows pending_review + submit_review → pending_audit', () => {
    const next = transitionCase('PENDING_REVIEW', 'submit_review', 'user1');
    expect(next).toBe('PENDING_AUDIT');
  });

  it('allows pending_audit + open_audit → in_audit', () => {
    expect(transitionCase('PENDING_AUDIT', 'open_audit', 'user1')).toBe('IN_AUDIT');
  });

  it('allows in_audit + sign → closed', () => {
    expect(transitionCase('IN_AUDIT', 'sign', 'user1')).toBe('CLOSED');
  });

  it('allows in_audit + reject → pending_review (loops back)', () => {
    expect(transitionCase('IN_AUDIT', 'reject', 'user1')).toBe('PENDING_REVIEW');
  });

  it('rejects pending_review + sign', () => {
    let caught: unknown;
    try {
      transitionCase('PENDING_REVIEW', 'sign', 'user1');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BusinessError);
    expect((caught as BusinessError).code).toBe('invalid_transition');
  });

  it('rejects closed + anything', () => {
    expect(() => transitionCase('CLOSED', 'reject', 'user1')).toThrow(BusinessError);
  });

  it('exposes transition table for inspection', () => {
    expect(CASE_TRANSITIONS.PENDING_REVIEW.submit_review).toBe('PENDING_AUDIT');
  });
});
