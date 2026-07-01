import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const grouped = await this.prisma.hazards.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { review_count: true },
    });
    let total = 0;
    let pending = 0;
    let passed = 0;
    let failed = 0;
    let reviewCount = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status === 'pending') pending = n;
      else if (g.status === 'passed') passed = n;
      else if (g.status === 'failed') failed = n;
      reviewCount += g._sum.review_count ?? 0;
    }
    const reviewed = passed + failed;
    const taskCount = await this.prisma.review_tasks.count();
    return {
      total_hazards: total,
      pending_count: pending,
      passed_count: passed,
      failed_count: failed,
      reviewed_count: reviewed,
      review_count: reviewCount,
      task_count: taskCount,
      coverage_rate: total > 0 ? Number((reviewed / total).toFixed(4)) : 0,
      pass_rate: reviewed > 0 ? Number((passed / reviewed).toFixed(4)) : 0,
    };
  }

  async trend(start?: Date, end?: Date) {
    const where: { stat_date?: { gte?: Date; lte?: Date } } = {};
    if (start) where.stat_date = { ...(where.stat_date ?? {}), gte: start };
    if (end) where.stat_date = { ...(where.stat_date ?? {}), lte: end };
    return this.prisma.statistics_daily.findMany({ where, orderBy: { stat_date: 'asc' } });
  }

  /**
   * Recompute the daily rollup for a single date. Upserts the
   * (stat_date, enterprise_id=null, batch_id=null, inspector_id=null)
   * row that the dashboard reads.
   */
  async rollupDaily(day: Date): Promise<void> {
    const start = startOfDay(day);
    const end = endOfDay(day);
    const grouped = await this.prisma.hazards.groupBy({
      by: ['status'],
      where: { created_at: { gte: start, lte: end } },
      _count: { _all: true },
    });
    let total = 0;
    let pending = 0;
    let passed = 0;
    let failed = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status === 'pending') pending = n;
      else if (g.status === 'passed') passed = n;
      else if (g.status === 'failed') failed = n;
    }
    const taskCount = await this.prisma.review_tasks.count({
      where: { created_at: { gte: start, lte: end } },
    });
    const reviewed = passed + failed;
    const coverage = total > 0 ? Number((reviewed / total).toFixed(4)) : 0;
    const passRate = reviewed > 0 ? Number((passed / reviewed).toFixed(4)) : 0;

    // The unique key is (stat_date, enterprise_id, batch_id, inspector_id);
    // for the global rollup all FKs are null. Prisma's compound-unique
    // upsert is awkward with nulls, so we delete + insert.
    await this.prisma.statistics_daily.deleteMany({
      where: { stat_date: start, enterprise_id: null, batch_id: null, inspector_id: null },
    });
    await this.prisma.statistics_daily.create({
      data: {
        stat_date: start,
        total_hazards: total,
        pending_count: pending,
        passed_count: passed,
        failed_count: failed,
        review_count: reviewed,
        task_count: taskCount,
      },
    });
  }

  async rollupMonthly(month: Date): Promise<void> {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const grouped = await this.prisma.hazards.groupBy({
      by: ['status'],
      where: { created_at: { gte: start, lte: end } },
      _count: { _all: true },
    });
    let total = 0;
    let pending = 0;
    let passed = 0;
    let failed = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status === 'pending') pending = n;
      else if (g.status === 'passed') passed = n;
      else if (g.status === 'failed') failed = n;
    }
    const taskCount = await this.prisma.review_tasks.count({
      where: { created_at: { gte: start, lte: end } },
    });
    const reviewed = passed + failed;
    const coverage = total > 0 ? Number((reviewed / total).toFixed(4)) : 0;
    const passRate = reviewed > 0 ? Number((passed / reviewed).toFixed(4)) : 0;

    // stat_month is a string column (YYYY-MM). The unique key is
    // (stat_month, enterprise_id, batch_id, inspector_id); for the
    // global rollup all FKs are null.
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    await this.prisma.statistics_monthly.deleteMany({
      where: { stat_month: monthKey, enterprise_id: null, batch_id: null, inspector_id: null },
    });
    await this.prisma.statistics_monthly.create({
      data: {
        stat_month: monthKey,
        total_hazards: total,
        pending_count: pending,
        passed_count: passed,
        failed_count: failed,
        review_count: reviewed,
        task_count: taskCount,
      },
    });
  }

  /** 03:00 daily: roll up yesterday. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyRollup(): Promise<void> {
    try {
      await this.rollupDaily(subDays(new Date(), 1));
      this.logger.log('daily rollup ok');
    } catch (err) {
      this.logger.error(`daily rollup failed: ${(err as Error).message}`);
    }
  }

  /** 03:30 on the 1st of each month: roll up the previous month. */
  @Cron('30 3 1 * *')
  async monthlyRollup(): Promise<void> {
    try {
      await this.rollupMonthly(subMonths(new Date(), 1));
      this.logger.log('monthly rollup ok');
    } catch (err) {
      this.logger.error(`monthly rollup failed: ${(err as Error).message}`);
    }
  }
}
