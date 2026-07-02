import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  /**
   * Expose Prometheus metrics at /metrics. Marked @Public because the
   * scraper is unauthenticated by convention. Restrict via Nginx
   * / firewall in production.
   */
  @Public()
  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
