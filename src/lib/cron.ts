import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { log } from './log';

const jobs: ScheduledTask[] = [];

export function registerCron(name: string, schedule: string, fn: () => Promise<void>) {
  if (!cron.validate(schedule)) throw new Error(`Invalid cron schedule: ${schedule}`);
  const task = cron.schedule(schedule, async () => {
    log.info({ name }, 'cron:start');
    try {
      await fn();
      log.info({ name }, 'cron:done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ name, err: message }, 'cron:error');
    }
  });
  jobs.push(task);
  log.info({ name, schedule }, 'cron:registered');
}

export function startCrons() {
  for (const j of jobs) j.start();
}
