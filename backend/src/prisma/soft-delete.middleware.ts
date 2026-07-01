import { Prisma } from '@prisma/client';

/**
 * Models that get a soft-delete filter applied automatically.
 * Phase 2 will extend this list with batches, hazards, etc.
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  'users',
  'enterprises',
  'batches',
  'hazards',
  'review_tasks',
  'task_hazards',
  'notifications',
  'audit_logs',
  'photos',
  'hazard_status_history',
  'reports',
  'statistics_daily',
  'statistics_monthly',
]);

function appendDeletedAtNull(where: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!where) return { deleted_at: null };
  if ('deleted_at' in where) return where;
  return { ...where, deleted_at: null };
}

export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const model = params.model ?? '';
  if (!SOFT_DELETE_MODELS.has(model)) {
    return next(params);
  }

  if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
    const lookup = (params.args as { where?: Record<string, unknown> }).where ?? {};
    return next({
      ...params,
      action: 'findFirst',
      args: { ...(params.args as object), where: { AND: [lookup, { deleted_at: null }] } },
    });
  }

  const readActions = new Set([
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
  ]);
  if (readActions.has(params.action)) {
    const args = (params.args ?? {}) as { where?: Record<string, unknown> };
    return next({ ...params, args: { ...args, where: appendDeletedAtNull(args.where) } });
  }

  return next(params);
};
