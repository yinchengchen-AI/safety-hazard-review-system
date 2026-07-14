import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<{
    total_hazards: number;
    pending_count: number;
    passed_count: number;
    failed_count: number;
    reviewed_count: number;
    review_count: number;
    task_count: number;
    coverage_rate: number;
    pass_rate: number;
  }> {
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

  async trend(start?: Date, end?: Date): Promise<Array<{
    period: string;
    total_hazards: number | null;
    pending_count: number | null;
    passed_count: number | null;
    failed_count: number | null;
    review_count: number | null;
    task_count: number | null;
  }>> {
    const where: { stat_date?: { gte?: Date; lte?: Date } } = {};
    if (start) where.stat_date = { ...(where.stat_date ?? {}), gte: start };
    if (end) where.stat_date = { ...(where.stat_date ?? {}), lte: end };
    const rows = await this.prisma.statistics_daily.findMany({ where, orderBy: { stat_date: 'asc' } });
    return rows.map((r) => ({
      period: r.stat_date ? r.stat_date.toISOString().slice(0, 10) : '',
      total_hazards: r.total_hazards,
      pending_count: r.pending_count,
      passed_count: r.passed_count,
      failed_count: r.failed_count,
      review_count: r.review_count,
      task_count: r.task_count,
    }));
  }

  /**
   * Compute the rollup for a single day. The semantics are:
   *  - ``total_hazards`` / ``pending_count`` / ``passed_count`` /
   *    ``failed_count`` = hazards CREATED on that day, with their
   *    current status. This is "what did we add today and how does
   *    it look now", not "what changed today".
   *  - ``review_count`` = number of distinct review events
   *    (transitions to passed/failed) on that day, derived from
   *    ``hazard_status_history``. This is the "how many reviews
   *    happened today" number that the dashboard chart actually
   *    wants to plot.
   *  - ``task_count`` = review tasks created on that day.
   *
   * The delete+create is wrapped in a transaction so a parallel
   * read between the two statements never sees an empty row.
   */
  async rollupDaily(day: Date): Promise<void> {
    const start = startOfDay(day);
    const end = endOfDay(day);

    const [grouped, reviewEvents, taskCount] = await Promise.all([
      this.prisma.hazards.groupBy({
        by: ['status'],
        where: { created_at: { gte: start, lte: end } },
        _count: { _all: true },
      }),
      this.prisma.hazard_status_history.count({
        where: {
          changed_at: { gte: start, lte: end },
          to_status: { in: ['passed', 'failed'] },
        },
      }),
      this.prisma.review_tasks.count({
        where: { created_at: { gte: start, lte: end } },
      }),
    ]);

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

    // The unique key is (stat_date, enterprise_id, batch_id,
    // inspector_id); for the global rollup all FKs are null. We
    // delete + insert inside a transaction so a parallel reader
    // never sees the row disappear. The application-level unique
    // index still serialises concurrent rollups.
    await this.prisma.$transaction(async (tx) => {
      await tx.statistics_daily.deleteMany({
        where: { stat_date: start, enterprise_id: null, batch_id: null, inspector_id: null },
      });
      await tx.statistics_daily.create({
        data: {
          stat_date: start,
          total_hazards: total,
          pending_count: pending,
          passed_count: passed,
          failed_count: failed,
          review_count: reviewEvents,
          task_count: taskCount,
        },
      });
    });
  }

  async rollupMonthly(month: Date): Promise<void> {
    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const [grouped, reviewEvents, taskCount] = await Promise.all([
      this.prisma.hazards.groupBy({
        by: ['status'],
        where: { created_at: { gte: start, lte: end } },
        _count: { _all: true },
      }),
      this.prisma.hazard_status_history.count({
        where: {
          changed_at: { gte: start, lte: end },
          to_status: { in: ['passed', 'failed'] },
        },
      }),
      this.prisma.review_tasks.count({
        where: { created_at: { gte: start, lte: end } },
      }),
    ]);

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
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.statistics_monthly.deleteMany({
        where: { stat_month: monthKey, enterprise_id: null, batch_id: null, inspector_id: null },
      });
      await tx.statistics_monthly.create({
        data: {
          stat_month: monthKey,
          total_hazards: total,
          pending_count: pending,
          passed_count: passed,
          failed_count: failed,
          review_count: reviewEvents,
          task_count: taskCount,
        },
      });
    });
  }

  /** 03:00 daily (worker process only): roll up yesterday. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyRollup(): Promise<void> {
    try {
      await this.rollupDaily(subDays(new Date(), 1));
      this.logger.log('daily rollup ok');
    } catch (err) {
      this.logger.error(`daily rollup failed: ${(err as Error).message}`);
    }
  }

  /** 03:30 on the 1st of each month (worker process only). */
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
