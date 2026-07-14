import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Liveness vs readiness split:
 *  - ``/health`` (a.k.a. liveness): the process is up and able to
 *    answer HTTP. Returns 200 unconditionally so a DB outage does
 *    not cascade-restart every replica.
 *  - ``/health/ready`` (readiness): the dependency graph is
 *    actually usable. Returns 503 when the database is
 *    unreachable so k8s / the load balancer can drain this
 *    instance.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<{ status: 'ok' | 'degraded'; db: 'up' | 'down' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'down',
        error: (err as Error).message,
      });
    }
  }
}
