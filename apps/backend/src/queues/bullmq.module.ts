import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const REPORT_QUEUE = 'report-queue';
export const NOTIFICATION_QUEUE = 'notification-queue';

function redisConnectionFromConfig(config: ConfigService): {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
  tls?: object;
} {
  // P0-7: BullMQ used to drop the URL password, which meant
  // production Redis with requirepass silently failed.
  const raw = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0';
  const url = new URL(raw);
  const isTls = url.protocol === 'rediss:';
  const pathname = url.pathname && url.pathname !== '/' ? url.pathname.replace('/', '') : '0';
  const db = Number(pathname);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(Number.isFinite(db) ? { db } : {}),
    ...(isTls ? { tls: {} } : {}),
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromConfig(config),
      }),
    }),
    BullModule.registerQueue(
      { name: REPORT_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
