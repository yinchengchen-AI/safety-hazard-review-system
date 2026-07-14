# Production DB audit: enterprise credit_code dedup

This is the read-only companion to the migration
`apps/backend/prisma/migrations/20260714070000_enterprise_credit_code_unique/migration.sql`.

The migration itself will soft-delete duplicate `enterprises` rows
(keeping the oldest by `created_at`), reassign their `hazards` to the
survivor, and finally create a partial unique index
`uix_enterprises_credit_code` on `(credit_code) WHERE credit_code IS NOT NULL AND deleted_at IS NULL`.

Before running that migration against the production database, run
the audit to see exactly what will happen.

## How to run

Use a read-only or low-privilege role. The script is 100% SELECTs
plus a few CTEs — nothing mutates the database.

```bash
PGPASSWORD=... \
  psql -h <prod-host> -p 5432 -U <user> -d safety_hazard \
  -v ON_ERROR_STOP=1 \
  -f docs/operations/2026-07-14-enterprise-dedup-audit.sql
```

## What it reports

| Section | Purpose |
| --- | --- |
| 1 | Each credit_code that has more than one live row, with the `id` the migration would keep |
| 2 | The first 500 hazards that would be reassigned to the kept enterprise |
| 3 | Total count of hazards that would be reassigned |
| 4 | Each enterprise row that would be soft-deleted, paired with the `id` of the row that survives |
| 5 | Verdict: would the unique index violate *right now*? (if yes, the migration is still required; if no, a re-run is a no-op) |
| 6a-c | Other schema-level uniqueness checks (users.username, task_hazards(task_id, hazard_id), notifications(user_id, type, related_id)) — these have UNIQUE constraints already, so 0 rows is expected |

## Interpreting the output

- If section 1, 3 and 4 are all empty and section 5 says `no — no
  duplicates`, the database is already in a clean state and the
  migration is a no-op.
- If section 1 has rows, **record the counts** before applying the
  migration so you can verify post-migration that
  `SELECT COUNT(*) FROM enterprises WHERE deleted_at > <migration_ts>`
  matches expectations.
- Section 6a-c should always be empty; if any of them has rows, that
  is a separate pre-existing data integrity issue and the migration
  is not the right tool to fix it.

## Caveats

- The audit is a snapshot. Between the time you run it and the time
  you apply the migration, the data can change. Re-run the audit
  immediately before applying the migration if you want a definitive
  number.
- The script does not currently check `enterprises.name`
  uniqueness. That is by design: many businesses share a name
  (e.g. multiple "示例公司" entries are common in import test
  data), and only `credit_code` is treated as a strong identity.
