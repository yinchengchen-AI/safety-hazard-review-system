import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { ReportProcessor } from './report.processor';
import { NotificationCleanupProcessor } from './notification-cleanup.processor';

/**
 * Worker entrypoint — runs in a separate container. It bootstraps the
 * Nest application (which auto-registers BullMQ workers + cron jobs
 * from the providers) and keeps the process alive.
 */
async function main(): Promise<void> {
  const log = new Logger('worker');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false })
  await app.init()
  log.log('worker ready: ReportProcessor + NotificationCleanupProcessor registered')
  // Keep process alive
  process.on('SIGTERM', async () => { await app.close(); process.exit(0) })
  process.on('SIGINT', async () => { await app.close(); process.exit(0) })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('worker failed to start:', err)
  process.exit(1)
})
