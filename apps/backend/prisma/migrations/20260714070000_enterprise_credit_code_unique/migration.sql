-- Add a partial unique index on enterprises.credit_code so the
-- import path can rely on the database to reject duplicate
-- businesses. NULL credit_codes are excluded so rows that were
-- imported without a code (common in the early dataset) are not
-- forced into a conflict.
--
-- Pre-migration: merge any existing duplicate credit_code rows
-- into the oldest one per group, reassign hazards to the kept
-- enterprise, then delete the duplicates. Wrapped in a single
-- transaction so the schema is never observable in an
-- intermediate state.
BEGIN;

DO $$
DECLARE
  dup_record RECORD;
  keep_id UUID;
  merge_ids UUID[];
BEGIN
  FOR dup_record IN
    SELECT credit_code
      FROM enterprises
     WHERE credit_code IS NOT NULL
       AND deleted_at IS NULL
     GROUP BY credit_code
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the oldest surviving row as the canonical one.
    SELECT id INTO keep_id
      FROM enterprises
     WHERE credit_code = dup_record.credit_code
       AND deleted_at IS NULL
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1;

    -- Reassign every hazard / task_hazard pointing at a duplicate
    -- to the canonical row.
    UPDATE hazards h
       SET enterprise_id = keep_id
      FROM enterprises e
     WHERE h.enterprise_id = e.id
       AND e.credit_code = dup_record.credit_code
       AND e.id <> keep_id
       AND e.deleted_at IS NULL;

    -- Soft-delete the duplicate enterprise rows.
    UPDATE enterprises
       SET deleted_at = NOW()
     WHERE credit_code = dup_record.credit_code
       AND deleted_at IS NULL
       AND id <> keep_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "uix_enterprises_credit_code"
    ON "enterprises" ("credit_code")
 WHERE "credit_code" IS NOT NULL
   AND "deleted_at" IS NULL;

COMMIT;
