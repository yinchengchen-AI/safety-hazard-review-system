import { Prisma } from '@prisma/client';

/**
 * Models that carry a ``deleted_at`` column. Other models that
 * the legacy Python side may have soft-deleted are intentionally
 * excluded here: the DB schema we reverse-engineered with
 * ``prisma db pull`` does not have these columns, and Prisma's
 * typed filter would reject the middleware-injected
 * ``deleted_at: null`` clause.
 *
 * IMPORTANT: this middleware ONLY auto-filters read queries; it
 * does NOT intercept ``update`` / ``updateMany`` / ``delete`` /
 * ``deleteMany``. Services that want a soft delete must
 * explicitly do ``data: { deleted_at: new Date() }`` (or include
 * it in the update payload). The audit_logs / hazard_status_history
 * / reports / statistics_* models do not have a ``deleted_at``
 * column at all, so hard deletes are the only option there.
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  'users',
  'enterprises',
  'batches',
  'hazards',
  'review_tasks',
  'task_hazards',
  'notifications',
  'photos',
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
