import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BatchReviewRequestDto,
  CreateReviewTaskDto,
  ReviewTaskDetailResponseDto,
  ReviewTaskResponseDto,
  ReviewSingleHazardDto,
} from './dto/review-task.dto';

function toDto(t: any, extras: Partial<ReviewTaskResponseDto> = {}): ReviewTaskResponseDto {
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
  constructor(private readonly prisma: PrismaService) {}

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
    const hazards = await this.prisma.$transaction(async (tx) => {
      // Lock the rows we plan to attach.
      return await tx.hazards.findMany({
        where: { id: { in: ids } },
        // Note: FOR UPDATE requires raw SQL or interactive transaction.
        // For Phase 2 we accept best-effort locking; the soft-delete
        // middleware already ensures deleted_at IS NULL.
      });
    });

    if (hazards.length !== ids.length) {
      throw new BadRequestException('Some hazards not found');
    }
    for (const h of hazards) {
      if (h.current_task_id) {
        throw new BadRequestException(`Hazard ${h.id} is already in another review task`);
      }
    }

    const task = await this.prisma.review_tasks.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        creator_id: creatorId,
        status: 'pending',
      },
    });

    for (const h of hazards) {
      await this.prisma.hazards.update({
        where: { id: h.id },
        data: { current_task_id: task.id },
      });
      await this.prisma.task_hazards.create({
        data: { task_id: task.id, hazard_id: h.id },
      });
    }

    return toDto(task, { hazard_count: hazards.length, reviewed_count: 0 });
  }

  async list(): Promise<ReviewTaskResponseDto[]> {
    const tasks = await this.prisma.review_tasks.findMany({
      orderBy: { created_at: 'desc' },
      include: { users: true },
    });
    if (tasks.length === 0) return [];
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

    return tasks.map((t) =>
      toDto(t, {
        hazard_count: hazMap.get(t.id) ?? 0,
        reviewed_count: revMap.get(t.id) ?? 0,
        report_status: reportMap.get(t.id) ?? null,
      }),
    );
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
    const taskHazard = await this.prisma.task_hazards.findFirst({
      where: { task_id: taskId, hazard_id: hazardId },
    });
    if (!taskHazard) throw new NotFoundException('Task hazard not found');

    const task = await this.prisma.review_tasks.findFirst({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Review task not found');
    if (task.status !== 'pending') {
      throw new BadRequestException('Only pending tasks can be reviewed');
    }

    const isEdit = taskHazard.status_in_task !== null;
    const now = new Date();
    await this.prisma.task_hazards.update({
      where: { id: taskHazard.id },
      data: {
        conclusion: dto.conclusion,
        status_in_task: dto.status_in_task,
        reviewed_at: now,
        reviewer_id: reviewerId,
      },
    });

    const hazard = await this.prisma.hazards.findFirst({ where: { id: hazardId } });
    if (!hazard) throw new NotFoundException('Hazard not found');

    const oldStatus = hazard.status;
    const shouldIncrement =
      !isEdit && oldStatus === 'pending' &&
      (dto.status_in_task === 'passed' || dto.status_in_task === 'failed');
    await this.prisma.hazards.update({
      where: { id: hazard.id },
      data: {
        status: dto.status_in_task,
        ...(shouldIncrement ? { review_count: { increment: 1 } } : {}),
      },
    });

    // Status history row.
    const reasonSuffix = isEdit ? ' (edited)' : '';
    await this.prisma.hazard_status_history.create({
      data: {
        hazard_id: hazard.id,
        from_status: oldStatus,
        to_status: dto.status_in_task,
        changed_by: reviewerId,
        reason: `Reviewed in task ${taskId}${reasonSuffix}`,
      },
    });

    // Phase 3 hook: photo token binding. For now we just clear the
    // tokens (Phase 3 wires up the photo storage).
    if (dto.photo_tokens?.length) {
      await this.prisma.photos.updateMany({
        where: { temp_token: { in: dto.photo_tokens } },
        data: { task_hazard_id: taskHazard.id, temp_token: null },
      });
    }

    return this.prisma.task_hazards.findFirst({ where: { id: taskHazard.id } });
  }

  async batchReview(
    taskId: string,
    dto: BatchReviewRequestDto,
    reviewerId: string,
  ) {
    const task = await this.prisma.review_tasks.findFirst({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Review task not found');
    if (task.status !== 'pending') {
      throw new BadRequestException('Only pending tasks can be reviewed');
    }

    const out: any[] = [];
    for (const item of dto.items) {
      const result = await this.reviewHazard(taskId, item.hazard_id, item, reviewerId);
      out.push(result);
    }
    return out;
  }

  async complete(taskId: string, userId: string) {
    const task = await this.prisma.review_tasks.findFirst({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Review task not found');
    if (task.status !== 'pending') {
      throw new BadRequestException('Only pending tasks can be completed');
    }

    const unreviewed = await this.prisma.task_hazards.count({
      where: { task_id: task.id, status_in_task: null },
    });
    if (unreviewed > 0) {
      throw new BadRequestException('存在未复核的隐患，无法完成任务');
    }

    // Release the task lock on every hazard.
    await this.prisma.hazards.updateMany({
      where: { current_task_id: task.id },
      data: { current_task_id: null },
    });

    const updated = await this.prisma.review_tasks.update({
      where: { id: task.id },
      data: { status: 'completed', completed_at: new Date() },
    });

    // Phase 3 hook: enqueue report generation. The orchestrator lives
    // in Phase 3 — for now we mark a stub so the integration test path
    // is exercised end-to-end.
    return updated;
  }

  async cancel(taskId: string, userId: string) {
    const task = await this.prisma.review_tasks.findFirst({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Review task not found');

    // Revert reviewed hazards: status -> pending, review_count -= 1,
    // history row. This mirrors the Python ``cancel_task`` behaviour
    // that was added during the data-integrity review.
    const taskHazards = await this.prisma.task_hazards.findMany({
      where: { task_id: task.id },
    });
    const reviewed = taskHazards.filter((th) => th.status_in_task !== null);
    if (reviewed.length > 0) {
      const hazards = await this.prisma.hazards.findMany({
        where: { id: { in: reviewed.map((th) => th.hazard_id) } },
      });
      const byId = new Map(hazards.map((h) => [h.id, h]));
      for (const th of reviewed) {
        const h = byId.get(th.hazard_id);
        if (!h) continue;
        const oldStatus = h.status;
        await this.prisma.hazards.update({
          where: { id: h.id },
          data: {
            status: 'pending',
            review_count:
              (oldStatus === 'passed' || oldStatus === 'failed') && (h.review_count ?? 0) > 0
                ? { decrement: 1 }
                : undefined,
          },
        });
        await this.prisma.hazard_status_history.create({
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
    await this.prisma.hazards.updateMany({
      where: { current_task_id: task.id },
      data: { current_task_id: null },
    });

    return this.prisma.review_tasks.update({
      where: { id: task.id },
      data: { status: 'cancelled' },
    });
  }
}
