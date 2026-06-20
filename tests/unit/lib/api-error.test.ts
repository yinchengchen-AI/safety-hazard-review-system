import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError, problem } from '@/lib/api-error';
import { BusinessError } from '@/lib/errors';

describe('api-error', () => {
  describe('problem()', () => {
    it('returns 4xx NextResponse with problem+json content type', async () => {
      const r = problem(404, 'not_found', 'oops');
      expect(r.status).toBe(404);
      expect(r.headers.get('Content-Type')).toBe('application/problem+json');
      const body = await r.json();
      expect(body).toEqual({ code: 'not_found', message: 'oops' });
    });

    it('works with 5xx codes', async () => {
      const r = problem(503, 'down', 'try later');
      expect(r.status).toBe(503);
      expect((await r.json()).code).toBe('down');
    });
  });

  describe('handleError()', () => {
    let errSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      errSpy.mockRestore();
    });

    it('maps BusinessError to its httpStatus + code', async () => {
      const e = new BusinessError('weird', 'weird thing', 422);
      const r = handleError(e);
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe('weird');
    });

    it('maps ZodError-like shape to 400 validation_error with field messages', async () => {
      const zodLike = {
        name: 'ZodError',
        issues: [
          { path: ['name'], message: 'required' },
          { path: ['age'], message: 'must be number' },
        ],
      };
      const r = handleError(zodLike);
      expect(r.status).toBe(400);
      const body = await r.json();
      expect(body.code).toBe('validation_error');
      expect(body.message).toContain('name: required');
      expect(body.message).toContain('age: must be number');
    });

    it('falls back to 500 internal_error for unknown errors and logs them', async () => {
      const r = handleError(new Error('boom'));
      expect(r.status).toBe(500);
      const body = await r.json();
      expect(body.code).toBe('internal_error');
      expect(body.message).toBe('boom');
      expect(errSpy).toHaveBeenCalled();
    });

    it('handles non-Error throws (e.g. thrown strings)', async () => {
      const r = handleError('nope');
      expect(r.status).toBe(500);
      expect((await r.json()).message).toBe('nope');
    });
  });
});
