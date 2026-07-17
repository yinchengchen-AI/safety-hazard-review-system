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

/**
 * Foreign-key columns on each model that point at a soft-delete
 * parent, mapped to the Prisma relation field name (which is the
 * target model name in plural form on the parent model).
 *
 * The keys on the left are FK column names; the values are the
 * corresponding Prisma ``include``/``where`` relation field names.
 * Using the actual relation field name avoids the type system
 * complaining about an unknown argument.
 */
const RELATION_FK_TO_LIVE_PARENT: Record<string, string> = {
  enterprise_id: 'enterprises',
  batch_id: 'batches',
  creator_id: 'users',
  uploader_id: 'users',
  user_id: 'users',
  hazard_id: 'hazards',
  task_id: 'review_tasks',
  task_hazard_id: 'task_hazards',
};

function appendDeletedAtNull(where: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!where) return { deleted_at: null };
  if ('deleted_at' in where) return where;
  return { ...where, deleted_at: null };
}

/**
 * For each FK in the where clause that points at a soft-delete
 * model, add a relation ``{fk: { deleted_at: null }}`` so the
 * query never returns rows whose parent is soft-deleted.
 *
 * NOTE: this only injects the filter for the top-level FK
 * (e.g. ``where: { enterprise_id }``). It does not recursively
 * walk into nested relation filters that the caller may have
 * written by hand — callers can still use ``enterprises: { deleted_at: null }``
 * for that. The combination is safe (AND'd).
 */
function appendLiveParentFilters(
  where: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base = where ?? {};
  const additions: Record<string, unknown> = {};
  for (const [fk, model] of Object.entries(RELATION_FK_TO_LIVE_PARENT)) {
    if (fk in base && SOFT_DELETE_MODELS.has(model)) {
      additions[model] = { deleted_at: null };
    }
  }
  if (Object.keys(additions).length === 0) return base;
  return { AND: [base, additions] };
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
      args: {
        ...(params.args as object),
        where: {
          AND: [lookup, { deleted_at: null }, appendLiveParentFilters(lookup)],
        },
      },
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
    return next({
      ...params,
      args: {
        ...args,
        where: {
          ...appendDeletedAtNull(args.where),
          ...appendLiveParentFilters(args.where),
        },
      },
    });
  }

  return next(params);
};
