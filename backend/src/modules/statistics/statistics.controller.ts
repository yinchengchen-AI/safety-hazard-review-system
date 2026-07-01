import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';

@Controller('api/v1/statistics')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class StatisticsController {
  constructor(private readonly stats: StatisticsService) {}

  @Get('overview')
  overview() {
    return this.stats.overview();
  }

  @Get('trend')
  trend(
    @Query('start_date') start?: string,
    @Query('end_date') end?: string,
  ) {
    return this.stats.trend(
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined,
    );
  }
}
