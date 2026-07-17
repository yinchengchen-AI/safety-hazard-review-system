import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS } from '../../queues/redis.provider';

export interface LoginRateLimitResult {
  blocked: boolean;
  retryAfterSec?: number;
  remaining?: number;
}

/**
 * P1-5: per-(IP, username) brute-force protection. The global
 * @nestjs/throttler counts only by IP so a credential-stuffing
 * attacker can rotate IPs to bypass it. We additionally count by
 * (IP + username) and by (username alone) so the same attacker is
 * also rate-limited on a single username across many IPs.
 *
 * Backed by Redis so multiple API replicas share the counter.
 * If Redis is unreachable we fail open (allow the attempt) so a
 * Redis outage doesn't lock everyone out — but we log loudly.
 */
@Injectable()
export class LoginRateLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoginRateLimiter.name);
  private readonly WINDOW_SEC = 60;
  private readonly MAX_PER_KEY = 5;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    // intentionally empty; ioredis connects lazily.
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.redis.quit(); } catch { /* ignore */ }
  }

  /**
   * Record a login attempt and decide whether to block.
   * ``outcome`` is 'success' or 'failure'; failures count toward
   * the limit, successes reset it.
   */
  async record(
    ip: string,
    username: string,
    outcome: 'success' | 'failure',
  ): Promise<LoginRateLimitResult> {
    if (!ip && !username) return { blocked: false };
    const keys = [
      `login:ip:${ip || 'unknown'}`,
      `login:user:${username.toLowerCase()}`,
      `login:pair:${ip || 'unknown'}:${username.toLowerCase()}`,
    ];
    try {
      if (outcome === 'success') {
        await Promise.all(keys.map((k) => this.redis.del(k)));
        return { blocked: false };
      }
      const pipeline = this.redis.pipeline();
      for (const k of keys) {
        pipeline.incr(k);
        pipeline.expire(k, this.WINDOW_SEC);
      }
      const results = await pipeline.exec();
      const counts = (results ?? []).map(([, v]) => Number(v));
      const max = Math.max(...counts);
      if (max >= this.MAX_PER_KEY) {
        const ttl = await this.redis.ttl(keys[counts.indexOf(max)]);
        return { blocked: true, retryAfterSec: ttl > 0 ? ttl : this.WINDOW_SEC };
      }
      return { blocked: false, remaining: this.MAX_PER_KEY - max };
    } catch (err) {
      this.logger.warn(`rate limit check failed (fail-open): ${(err as Error).message}`);
      return { blocked: false };
    }
  }
}
