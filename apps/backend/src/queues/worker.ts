import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { ReportProcessor } from './report.processor';
import { NotificationCleanupProcessor } from './notification-cleanup.processor';

/**
 * Worker entrypoint — runs in a separate container.
 *
 * ROLE=worker is set unconditionally before bootstrap so
 * ``AppModule``'s cron registration picks up the worker default
 * (cron ON for workers, OFF for the API process). Setting it
 * explicitly in code means a container that forgets to export
 * ``ROLE`` in its env still behaves correctly.
 */
process.env.ROLE = process.env.ROLE ?? 'worker';

async function main(): Promise<void> {
  const log = new Logger('worker');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  await app.init();
  const reportProc = app.get(ReportProcessor);
  const cleanupProc = app.get(NotificationCleanupProcessor);
  log.log(
    `worker ready: ReportProcessor (${(reportProc as unknown as { processor: { concurrency?: number } }).processor?.concurrency ?? 'n/a'}) + NotificationCleanupProcessor registered`,
  );
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('worker failed to start:', err);
  process.exit(1);
});
