-- P1-12: replace the @@unique([stat_date, enterprise_id, batch_id,
-- inspector_id]) declared in schema.prisma with a partial unique
-- index that only enforces uniqueness when ALL FK columns are
-- NULL (the global rollup row). For per-enterprise / per-batch /
-- per-inspector rows we still rely on application-level dedup,
-- which matches the existing rollupDaily / rollupMonthly logic.
DROP INDEX IF EXISTS "uix_stats_daily";
DROP INDEX IF EXISTS "uix_stats_monthly";

CREATE UNIQUE INDEX "uix_stats_daily_global"
    ON "statistics_daily" ("stat_date")
 WHERE "enterprise_id" IS NULL
   AND "batch_id" IS NULL
   AND "inspector_id" IS NULL;

CREATE UNIQUE INDEX "uix_stats_monthly_global"
    ON "statistics_monthly" ("stat_month")
 WHERE "enterprise_id" IS NULL
   AND "batch_id" IS NULL
   AND "inspector_id" IS NULL;
