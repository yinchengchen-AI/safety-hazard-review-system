import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const REPORT_QUEUE = 'report-queue';
export const NOTIFICATION_QUEUE = 'notification-queue';
export const STATS_QUEUE = 'stats-queue';

function redisConnectionFromConfig(config: ConfigService): { host: string; port: number } {
  const url = new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0');
  return { host: url.hostname, port: Number(url.port) || 6379 };
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
      { name: STATS_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
