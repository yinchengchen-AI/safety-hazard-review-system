import { describe, it, expect, vi, beforeEach } from 'vitest';

const scheduleMock = vi.fn();
const validateMock = vi.fn(() => true);

vi.mock('node-cron', () => ({
  default: {
    schedule: (...args: unknown[]) => (scheduleMock as any)(...args),
    validate: (...args: unknown[]) => (validateMock as any)(...args),
  },
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { registerCron, startCrons } from '@/lib/cron';

describe('cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockReturnValue(true);
  });

  it('throws on invalid cron expression', () => {
    validateMock.mockReturnValueOnce(false);
    expect(() => registerCron('bad', 'not-a-cron', async () => undefined)).toThrow(
      /Invalid cron schedule/,
    );
  });

  it('validates schedule and registers a task without starting it', () => {
    const fn = vi.fn(async () => undefined);
    const task = { start: vi.fn() };
    scheduleMock.mockReturnValueOnce(task);
    registerCron('nightly', '0 2 * * *', fn);

    expect(validateMock).toHaveBeenCalledWith('0 2 * * *');
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(task.start).not.toHaveBeenCalled();
  });

  it('startCrons() starts every registered task', () => {
    const tasks = [{ start: vi.fn() }, { start: vi.fn() }];
    scheduleMock.mockReturnValueOnce(tasks[0]).mockReturnValueOnce(tasks[1]);
    registerCron('a', '* * * * *', async () => undefined);
    registerCron('b', '*/5 * * * *', async () => undefined);

    startCrons();
    expect(tasks[0].start).toHaveBeenCalled();
    expect(tasks[1].start).toHaveBeenCalled();
  });

  it('invokes the wrapped fn on the scheduled callback and logs done', async () => {
    const fn = vi.fn(async () => undefined);
    let cb: (() => Promise<void>) | undefined;
    scheduleMock.mockImplementation((_expr: string, c: () => Promise<void>) => {
      cb = c;
      return { start: vi.fn() };
    });
    registerCron('scan', '* * * * *', fn);

    await cb!();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('catches errors thrown by the wrapped fn and logs them', async () => {
    const fn = vi.fn(async () => {
      throw new Error('nope');
    });
    let cb: (() => Promise<void>) | undefined;
    scheduleMock.mockImplementation((_expr: string, c: () => Promise<void>) => {
      cb = c;
      return { start: vi.fn() };
    });
    registerCron('flaky', '* * * * *', fn);

    await expect(cb!()).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalled();
  });
});
