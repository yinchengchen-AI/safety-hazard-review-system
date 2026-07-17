import Redis from 'ioredis';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URL } from 'url';

export const REDIS = Symbol('REDIS');

/**
 * Shared ioredis client used by BullMQ and the login rate limiter.
 * Reuses the same connection logic as bullmq.module so a Redis URL
 * with username:password@host:port works for both.
 */
export const redisProvider: Provider = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const raw = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0';
    const url = new URL(raw);
    const isTls = url.protocol === 'rediss:';
    const pathname = url.pathname && url.pathname !== '/' ? url.pathname.replace('/', '') : '0';
    const db = Number(pathname);
    return new Redis({
      host: url.hostname,
      port: Number(url.port) || 6379,
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(Number.isFinite(db) ? { db } : {}),
      ...(isTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  },
};
