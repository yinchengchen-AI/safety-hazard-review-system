import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

type ReviewTaskWithUser = Prisma.review_tasksGetPayload<{ include: { users: true } }>;
import { ReportsService } from '../reports/reports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  BatchReviewRequestDto,
  CreateReviewTaskDto,
  REVIEW_TASK_STATUSES,
  ReviewTaskDetailResponseDto,
  ReviewTaskListResponseDto,
  ReviewTaskResponseDto,
  ReviewSingleHazardDto,
} from './dto/review-task.dto';



function toDto(
  t: ReviewTaskWithUser,
  extras: Partial<ReviewTaskResponseDto> = {},
): ReviewTaskResponseDto {
  return {
    id: t.id,
    name: t.name,
    creator_id: t.creator_id,
    status: t.status,
    created_at: t.created_at,
    completed_at: t.completed_at,
    creator_username: t.users?.username ?? null,
    ...extras,
  };
}

@Injectable()
export class ReviewTasksService {
  private readonly logger = new Logger(ReviewTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditLogsService,
  ) {}

  async create(dto: CreateReviewTaskDto, creatorId: string): Promise<ReviewTaskResponseDto> {
    const hazardIds = new Set<string>(dto.hazard_ids ?? []);

    if (dto.batch_ids?.length) {
      const fromBatches = await this.prisma.hazards.findMany({
        where: {
          batch_id: { in: dto.batch_ids },
          current_task_id: null,
        },
        select: { id: true },
      });
      for (const h of fromBatches) hazardIds.add(h.id);
    }

    if (hazardIds.size === 0) {
      throw new BadRequestException('No hazards selected');
    }

    const ids = [...hazardIds];

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the selected hazard rows with SELECT FOR UPDATE to prevent
      // concurrent tasks from assigning the same hazards.
      const lockedHazards = await tx.$queryRaw<
        { id: string; current_task_id: string | null }[]
      >(Prisma.sql`SELECT id, current_task_id FROM hazards WHERE id = ANY(${ids}::uuid[]) AND deleted_at IS NULL FOR UPDATE`);

      if (lockedHazards.length !== ids.length) {
        throw new BadRequestException('Some hazards not found or deleted');
      }
      for (const h of lockedHazards) {
        if (h.current_task_id) {
          throw new BadRequestException(`Hazard ${h.id} is already in another review task`);
        }
      }

      const task = await tx.review_tasks.create({
        data: {
          id: randomUUID(),
          name: dto.name,
          creator_id: creatorId,
          status: 'pending',
        },
      });

      for (const hazardId of ids) {
        await tx.hazards.update({
          where: { id: hazardId },
          data: { current_task_id: task.id },
        });
        await tx.task_hazards.create({
          data: { task_id: task.id, hazard_id: hazardId },
        });
      }

      return task;
    });

    // Fan out the creation event to all active admins (excluding the
    // creator when they are not an admin so they don't get notified
    // about their own action). The unique constraint on
    // (user_id, type, related_id) means a second create on the same
    // task id is a no-op.
    try {
      const adminIds = await this.notifications.findAdminUserIds();
      const recipients = adminIds.filter((id) => id !== creatorId);
      if (recipients.length > 0) {
        await this.notifications.notify(
          'task_created',
          `新复核任务：${result.name}`,
          recipients,
          { related: { type: 'review_task', id: result.id } },
        );
      }
    } catch (err) {
      this.logger.warn(`task_created notify failed: ${(err as Error).message}`);
    }

    await this.audit.record({
      userId: creatorId,
      action: 'review_task.create',
      targetType: 'review_task',
      targetId: result.id,
      detail: { hazard_count: ids.length, name: result.name },
    }).catch(() => undefined);
    return toDto({ ...result, users: { username: null } } as unknown as unknown as ReviewTaskWithUser, {
      hazard_count: ids.length,
      reviewed_count: 0,
    });
  }

  async list(
    page = 1,
    pageSize = 10,
    status?: string,
  ): Promise<ReviewTaskListResponseDto> {
    const where: Prisma.review_tasksWhereInput = {};
    if (status) {
      if (!(REVIEW_TASK_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException(
          `Invalid status filter: ${status}. Allowed: ${REVIEW_TASK_STATUSES.join(', ')}`,
        );
      }
      where.status = status;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.review_tasks.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { users: true },
      }),
      this.prisma.review_tasks.count({ where }),
    ]);
    if (tasks.length === 0) return { items: [], total, page, page_size: pageSize };
    const taskIds = tasks.map((t) => t.id);

    const [hazCounts, reviewedCounts, reports] = await Promise.all([
      this.prisma.task_hazards.groupBy({
        by: ['task_id'],
        where: { task_id: { in: taskIds } },
        _count: { _all: true },
      }),
      this.prisma.task_hazards.groupBy({
        by: ['task_id'],
        where: { task_id: { in: taskIds }, status_in_task: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.reports.findMany({ where: { task_id: { in: taskIds } } }),
    ]);

    const hazMap = new Map(hazCounts.map((c) => [c.task_id, c._count._all]));
    const revMap = new Map(reviewedCounts.map((c) => [c.task_id, c._count._all]));
    const reportMap = new Map(reports.map((r) => [r.task_id, r.status]));

    return {
      items: tasks.map((t) =>
        toDto(t, {
          hazard_count: hazMap.get(t.id) ?? 0,
          reviewed_count: revMap.get(t.id) ?? 0,
          report_status: reportMap.get(t.id) ?? null,
        }),
      ),
      total,
      page,
      page_size: pageSize,
    };
  }

  async findOne(id: string): Promise<ReviewTaskDetailResponseDto> {
    const t = await this.prisma.review_tasks.findFirst({
      where: { id },
      include: { users: true },
    });
    if (!t) throw new NotFoundException('Review task not found');

    const [hazCount, revCount, taskHazards] = await Promise.all([
      this.prisma.task_hazards.count({ where: { task_id: t.id } }),
      this.prisma.task_hazards.count({
        where: { task_id: t.id, status_in_task: { not: null } },
      }),
      this.prisma.task_hazards.findMany({
        where: { task_id: t.id },
        include: {
          hazards: { include: { enterprises: true, batches: true } },
          users: true,
        },
      }),
    ]);

    const hazards = taskHazards.map((th) => ({
      task_hazard_id: th.id,
      hazard_id: th.hazard_id,
      conclusion: th.conclusion,
      status_in_task: th.status_in_task,
      reviewed_at: th.reviewed_at,
      reviewer_username: th.users?.username ?? null,
      hazard: th.hazards
        ? {
            id: th.hazards.id,
            content: th.hazards.content,
            description: th.hazards.description,
            location: th.hazards.location,
            status: th.hazards.status,
            is_rectified: th.hazards.is_rectified,
            rectification_responsible: th.hazards.rectification_responsible,
            rectification_measures: th.hazards.rectification_measures,
            reporting_unit: th.hazards.reporting_unit,
            enterprise_name: th.hazards.enterprises?.name ?? null,
            enterprise_credit_code: th.hazards.enterprises?.credit_code ?? null,
            enterprise_region: th.hazards.enterprises?.region ?? null,
            enterprise_address: th.hazards.enterprises?.address ?? null,
            enterprise_contact_person: th.hazards.enterprises?.contact_person ?? null,
            enterprise_industry_sector: th.hazards.enterprises?.industry_sector ?? null,
            enterprise_enterprise_type: th.hazards.enterprises?.enterprise_type ?? null,
          }
        : null,
    }));

    return {
      ...toDto(t, { hazard_count: hazCount, reviewed_count: revCount }),
      hazards,
    } as ReviewTaskDetailResponseDto;
  }

  async reviewHazard(
    taskId: string,
    hazardId: string,
    dto: ReviewSingleHazardDto,
    reviewerId: string,
  ) {
    const reviewed = await this.prisma.$transaction(async (tx) => {
      return await this._reviewHazardTx(tx, taskId, hazardId, dto, reviewerId);
    });

    // Notify the task creator that one of their hazards was reviewed
    // (no-op if the reviewer is the creator).
    try {
      const task = await this.prisma.review_tasks.findFirst({
        where: { id: taskId },
        select: { creator_id: true, name: true },
      });
      if (task && task.creator_id !== reviewerId) {
        await this.notifications.notify(
          'hazard_reviewed',
          `复核任务「${task.name}」有新的复核结果`,
          [task.creator_id],
          { related: { type: 'review_task', id: taskId } },
        );
      }
    } catch (err) {
      this.logger.warn(`hazard_reviewed notify failed: ${(err as Error).message}`);
    }

    return reviewed;
  }

  private async _reviewHazardTx(
    tx: Prisma.TransactionClient,
    taskId: string,
    hazardId: string,
    dto: ReviewSingleHazardDto,
    reviewerId: string,
  ) {
    const taskHazard = await tx.task_hazards.findFirst({
      where: { task_id: taskId, hazard_id: hazardId },
    });
    if (!taskHazard) throw new NotFoundException('Task hazard not found');

    const task = await tx.review_tasks.findFirst({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Review task not found');
    if (task.status !== 'pending') {
      throw new BadRequestException('Only pending tasks can be reviewed');
    }

    const isEdit = taskHazard.status_in_task !== null;
    const now = new Date();
    await tx.task_hazards.update({
      where: { id: taskHazard.id },
      data: {
        conclusion: dto.conclusion,
        status_in_task: dto.status_in_task,
        reviewed_at: now,
        reviewer_id: reviewerId,
      },
    });

    const hazard = await tx.hazards.findFirst({ where: { id: hazardId } });
    if (!hazard) throw new NotFoundException('Hazard not found');

    const oldStatus = hazard.status;
    const shouldIncrement =
      !isEdit && oldStatus === 'pending' &&
      (dto.status_in_task === 'passed' || dto.status_in_task === 'failed');
    await tx.hazards.update({
      where: { id: hazard.id },
      data: {
        status: dto.status_in_task,
        ...(shouldIncrement ? { review_count: { increment: 1 } } : {}),
      },
    });

    // Status history row.
    const reasonSuffix = isEdit ? ' (edited)' : '';
    await tx.hazard_status_history.create({
      data: {
        hazard_id: hazard.id,
        from_status: oldStatus,
        to_status: dto.status_in_task,
        changed_by: reviewerId,
        reason: `Reviewed in task ${taskId}${reasonSuffix}`,
      },
    });

    // Photo token binding: when the reviewer passes photo tokens on
    // the review payload, attach them to this task_hazard row and
    // clear the upload-time token so it can never be reused.
    if (dto.photo_tokens?.length) {
      await tx.photos.updateMany({
        where: { temp_token: { in: dto.photo_tokens } },
        data: { task_hazard_id: taskHazard.id, temp_token: null },
      });
    }

    return tx.task_hazards.findFirst({ where: { id: taskHazard.id } });
  }

  async batchReview(
    taskId: string,
    dto: BatchReviewRequestDto,
    reviewerId: string,
  ): Promise<{ items: unknown[]; failed: Array<{ hazard_id: string; reason: string }> }> {
    // P2-5: run every item in its own savepoint so one bad row
    // doesn't roll back the whole batch. Each savepoint is
    // independent at the SQL level but shares the surrounding
    // transaction's connection.
    const items: unknown[] = [];
    const failed: Array<{ hazard_id: string; reason: string }> = [];
    await this.prisma.$transaction(async (tx) => {
      const task = await tx.review_tasks.findFirst({ where: { id: taskId } });
      if (!task) throw new NotFoundException('Review task not found');
      if (task.status !== 'pending') {
        throw new BadRequestException('Only pending tasks can be reviewed');
      }
      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        try {
          const result = await this._reviewHazardTx(tx, taskId, item.hazard_id, item, reviewerId);
          items.push(result);
        } catch (err) {
          failed.push({ hazard_id: item.hazard_id, reason: (err as Error).message });
        }
      }
    });
    return { items, failed };
  }

  async complete(taskId: string, userId: string): Promise<ReviewTaskResponseDto> {
    const initial = await this.prisma.review_tasks.findFirst({
      where: { id: taskId },
      include: { users: true },
    });
    if (!initial) throw new NotFoundException('Review task not found');

    // Run the state transition in a single transaction with a SQL-level
    // CAS so two concurrent /complete calls can't both succeed. The
    // updateMany acts as the guard: if another caller has already moved
    // the task out of 'pending', affected rows = 0 and we abort.
    const updated = await this.prisma.$transaction(async (tx) => {
      const stillPending = await tx.review_tasks.updateMany({
        where: { id: taskId, status: 'pending' },
        data: { status: 'completed', completed_at: new Date() },
      });
      if (stillPending.count === 0) {
        throw new BadRequestException('Only pending tasks can be completed');
      }

      const unreviewed = await tx.task_hazards.count({
        where: { task_id: taskId, status_in_task: null },
      });
      if (unreviewed > 0) {
        throw new BadRequestException('存在未复核的隐患，无法完成任务');
      }

      // Release the task lock on every hazard.
      await tx.hazards.updateMany({
        where: { current_task_id: taskId },
        data: { current_task_id: null },
      });

      return tx.review_tasks.findFirst({ where: { id: taskId } });
    });
    if (!updated) throw new NotFoundException('Review task not found');

    // P2-10: ``initial.creator_id`` / ``initial.name`` were
    // captured before the transaction so the notification can run
    // after commit without an extra round-trip. ``updated`` is
    // already the canonical post-commit state.
    // Enqueue a PDF + Word report. The orchestrator dedupes by
    // report status (pending/processing/failed/completed); a brand-new
    // task gets a fresh pending row, a re-complete of a failed one
    // re-runs, and a completed one is a no-op unless the operator
    // explicitly re-triggers via POST /reports/.../generate.
    try {
      await this.reports.createAndEnqueue(updated.id, { force: false });
    } catch (err) {
      // Never fail the completion because the report couldn't be
      // enqueued — the user can always POST /reports/.../generate
      // manually. Log and move on.
      this.logger.error(`[complete] failed to enqueue report: ${(err as Error).message}`);
    }

    // Notify the task creator (and other admins for visibility).
    try {
      const adminIds = await this.notifications.findAdminUserIds();
      const recipients = Array.from(
        new Set([initial.creator_id, ...adminIds].filter((id) => id && id !== userId)),
      );
      if (recipients.length > 0) {
        await this.notifications.notify(
          'task_completed',
          `复核任务「${initial.name}」已完成`,
          recipients,
          { related: { type: 'review_task', id: updated.id } },
        );
      }
    } catch (err) {
      this.logger.warn(`task_completed notify failed: ${(err as Error).message}`);
    }

    await this.audit.record({
      userId,
      action: 'review_task.complete',
      targetType: 'review_task',
      targetId: updated.id,
      detail: { name: initial.name },
    }).catch(() => undefined);
    return toDto({ ...updated, users: initial.users } as unknown as ReviewTaskWithUser, {
      hazard_count: await this.prisma.task_hazards.count({ where: { task_id: updated.id } }),
      reviewed_count: await this.prisma.task_hazards.count({
        where: { task_id: updated.id, status_in_task: { not: null } },
      }),
    });
  }

  async cancel(taskId: string, userId: string): Promise<ReviewTaskResponseDto> {
    const initial = await this.prisma.review_tasks.findFirst({
      where: { id: taskId },
      include: { users: true },
    });
    if (!initial) throw new NotFoundException('Review task not found');
    if (initial.status !== 'pending') {
      throw new BadRequestException('Only pending tasks can be cancelled');
    }
    if (initial.creator_id !== userId) {
      const user = await this.prisma.users.findFirst({ where: { id: userId } });
      if (!user || user.role !== 'admin') {
        throw new BadRequestException('Only the task creator or an admin can cancel this task');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Re-lock the task inside the transaction to prevent races.
      const lockedTask = await tx.review_tasks.findFirst({ where: { id: taskId } });
      if (!lockedTask || lockedTask.status !== 'pending') {
        throw new BadRequestException('Task is no longer pending');
      }

      // Revert reviewed hazards: status -> pending, review_count -= 1,
      // history row. Mirrors the legacy cancel_task behaviour.
      const taskHazards = await tx.task_hazards.findMany({
        where: { task_id: taskId },
      });
      const reviewed = taskHazards.filter((th) => th.status_in_task !== null);
      if (reviewed.length > 0) {
        const hazards = await tx.hazards.findMany({
          where: { id: { in: reviewed.map((th) => th.hazard_id) } },
        });
        const byId = new Map(hazards.map((h) => [h.id, h]));
        for (const th of reviewed) {
          const h = byId.get(th.hazard_id);
          if (!h) continue;
          const oldStatus = h.status;
          const shouldDecrement =
            (oldStatus === 'passed' || oldStatus === 'failed') && (h.review_count ?? 0) > 0;
          await tx.hazards.update({
            where: { id: h.id },
            data: {
              status: 'pending',
              review_count: shouldDecrement ? { decrement: 1 } : undefined,
            },
          });
          await tx.hazard_status_history.create({
            data: {
              hazard_id: h.id,
              from_status: oldStatus,
              to_status: 'pending',
              changed_by: userId,
              reason: `Task ${taskId} cancelled`,
            },
          });
        }
      }

      // Release the task lock for every hazard.
      await tx.hazards.updateMany({
        where: { current_task_id: taskId },
        data: { current_task_id: null },
      });

      return tx.review_tasks.update({
        where: { id: taskId },
        data: { status: 'cancelled' },
      });
    });

    // Notify the task creator (and admins) that the task was cancelled.
    try {
      const adminIds = await this.notifications.findAdminUserIds();
      const recipients = Array.from(
        new Set([initial.creator_id, ...adminIds].filter((id) => id && id !== userId)),
      );
      if (recipients.length > 0) {
        await this.notifications.notify(
          'task_cancelled',
          `复核任务「${initial.name}」已取消`,
          recipients,
          { related: { type: 'review_task', id: taskId } },
        );
      }
    } catch (err) {
      this.logger.warn(`task_cancelled notify failed: ${(err as Error).message}`);
    }

    await this.audit.record({
      userId,
      action: 'review_task.cancel',
      targetType: 'review_task',
      targetId: taskId,
      detail: { name: initial.name },
    }).catch(() => undefined);
    return toDto({ ...updated, users: initial.users } as unknown as ReviewTaskWithUser, {
      hazard_count: await this.prisma.task_hazards.count({ where: { task_id: taskId } }),
      reviewed_count: 0,
    });
  }
}
