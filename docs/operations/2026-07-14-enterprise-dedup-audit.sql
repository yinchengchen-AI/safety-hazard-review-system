-- Read-only audit for the migration
-- 20260714070000_enterprise_credit_code_unique.
--
-- Usage (do NOT use a connection that has write privileges unless
-- you intend to commit):
--   PGPASSWORD=... psql -h <host> -U <user> -d safety_hazard \
--     -v ON_ERROR_STOP=1 -f docs/operations/2026-07-14-enterprise-dedup-audit.sql
--
-- All statements are SELECTs / CTEs that produce summary output.
-- Nothing here mutates the database. The accompanying migration
-- in apps/backend/prisma/migrations/20260714070000_*/migration.sql
-- is the one that actually merges duplicates and adds the index.

\echo '==== 1) Duplicate credit_code groups (would be merged) ===='
SELECT
  credit_code,
  COUNT(*)                           AS dup_count,
  MIN(created_at)                    AS oldest_created_at,
  MAX(created_at)                    AS newest_created_at,
  -- The id of the row the migration would keep (oldest surviving).
  (SELECT id FROM enterprises e2
    WHERE e2.credit_code = e.credit_code
      AND e2.deleted_at IS NULL
    ORDER BY e2.created_at ASC NULLS LAST, e2.id ASC
    LIMIT 1)                         AS keep_id
FROM enterprises e
WHERE credit_code IS NOT NULL
  AND deleted_at IS NULL
GROUP BY credit_code
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, credit_code;

\echo
\echo '==== 2) Hazards that would be reassigned to the kept enterprise ===='
SELECT
  e.credit_code,
  h.enterprise_id                  AS old_enterprise_id,
  h.id                             AS hazard_id,
  h.created_at                     AS hazard_created_at,
  (SELECT id FROM enterprises e2
    WHERE e2.credit_code = e.credit_code
      AND e2.deleted_at IS NULL
    ORDER BY e2.created_at ASC NULLS LAST, e2.id ASC
    LIMIT 1)                      AS new_enterprise_id
FROM hazards h
JOIN enterprises e ON e.id = h.enterprise_id
WHERE e.credit_code IS NOT NULL
  AND h.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM enterprises e3
     WHERE e3.credit_code = e.credit_code
       AND e3.deleted_at IS NULL
       AND e3.id <> h.enterprise_id
  )
ORDER BY e.credit_code, h.created_at DESC
LIMIT 500;

\echo
\echo '==== 3) Total hazard reassignments that the migration would do ===='
SELECT
  COUNT(*) AS hazards_to_reassign
FROM hazards h
JOIN enterprises e ON e.id = h.enterprise_id
WHERE e.credit_code IS NOT NULL
  AND h.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM enterprises e3
     WHERE e3.credit_code = e.credit_code
       AND e3.deleted_at IS NULL
       AND e3.id <> h.enterprise_id
  );

\echo
\echo '==== 4) Enterprises that would be soft-deleted (one per group) ===='
WITH keepers AS (
  SELECT DISTINCT ON (credit_code)
    credit_code,
    id AS keep_id
  FROM enterprises
  WHERE credit_code IS NOT NULL
    AND deleted_at IS NULL
  ORDER BY credit_code, created_at ASC NULLS LAST, id ASC
)
SELECT
  e.id                                AS would_delete_id,
  e.name                              AS would_delete_name,
  e.credit_code,
  e.created_at                        AS would_delete_created_at,
  k.keep_id                           AS kept_id
FROM enterprises e
JOIN keepers k ON k.credit_code = e.credit_code
WHERE e.deleted_at IS NULL
  AND e.id <> k.keep_id
ORDER BY e.credit_code, e.created_at;

\echo
\echo '==== 5) Would the unique index violate right now? ===='
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM enterprises
       WHERE credit_code IS NOT NULL
         AND deleted_at IS NULL
       GROUP BY credit_code
      HAVING COUNT(*) > 1
    )
    THEN 'YES — the migration would still need to run before the index can be created'
    ELSE 'no — no duplicates; the index can be created as-is (a re-run of the migration is a no-op)'
  END AS would_violate;

\echo
\echo '==== 6) Other uniqueness checks worth confirming before deploy ===='

\echo '-- 6a) users.username uniqueness (schema-level, no action expected) --'
SELECT username, COUNT(*) AS n
FROM users
WHERE deleted_at IS NULL
GROUP BY username
HAVING COUNT(*) > 1;

\echo '-- 6b) task_hazards(task_id, hazard_id) uniqueness (schema-level) --'
SELECT task_id, hazard_id, COUNT(*) AS n
FROM task_hazards
WHERE deleted_at IS NULL
GROUP BY task_id, hazard_id
HAVING COUNT(*) > 1;

\echo '-- 6c) notifications(user_id, type, related_id) uniqueness (schema-level) --'
SELECT user_id, type, related_id, COUNT(*) AS n
FROM notifications
WHERE deleted_at IS NULL
  AND related_id IS NOT NULL
GROUP BY user_id, type, related_id
HAVING COUNT(*) > 1;

\echo
\echo '==== done ===='
