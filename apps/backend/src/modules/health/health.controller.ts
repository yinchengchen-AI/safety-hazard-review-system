import { Controller, Get, HttpCode, HttpStatus, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import Redis from 'ioredis';
import { REDIS } from '../../queues/redis.provider';

/**
 * Liveness vs readiness split:
 *  - ``/health`` (a.k.a. liveness): the process is up and able to
 *    answer HTTP. Returns 200 unconditionally so a DB outage does
 *    not cascade-restart every replica.
 *  - ``/health/ready`` (readiness): the dependency graph is
 *    actually usable. Returns 503 when the database or Redis is
 *    unreachable so k8s / the load balancer can drain this
 *    instance.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<{ status: 'ok' | 'degraded'; db: 'up' | 'down'; redis: 'up' | 'down' }> {
    let db: 'up' | 'down' = 'up';
    let redis: 'up' | 'down' = 'up';
    let lastErr = '';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      db = 'down';
      lastErr = (err as Error).message;
    }
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        redis = 'down';
        lastErr = `unexpected ping response: ${pong}`;
      }
    } catch (err) {
      redis = 'down';
      lastErr = lastErr || (err as Error).message;
    }
    if (db === 'up' && redis === 'up') {
      return { status: 'ok', db, redis };
    }
    throw new ServiceUnavailableException({
      status: 'degraded',
      db,
      redis,
      error: lastErr,
    });
  }
}
