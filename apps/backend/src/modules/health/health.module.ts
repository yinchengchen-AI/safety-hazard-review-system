import { Global, Module } from '@nestjs/common';
import { redisProvider } from '../../queues/redis.provider';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

// @Global so the REDIS symbol is injectable everywhere — both
// HealthController and LoginRateLimiter need it without each module
// having to import the queues module.
@Global()
@Module({
  controllers: [HealthController, MetricsController],
  providers: [redisProvider],
  exports: [redisProvider],
})
export class HealthModule {}
