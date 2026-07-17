-- P1-4: prevent two live enterprises from sharing the same name.
-- NULL names are not allowed by the schema so the index is a plain
-- unique on (name) WHERE deleted_at IS NULL, matching the existing
-- partial-unique pattern on credit_code.
--
-- Pre-migration: collapse existing duplicates to the oldest row and
-- reassign any hazards that point at a duplicate.

BEGIN;

DO $$
DECLARE
  dup_record RECORD;
  keep_id UUID;
BEGIN
  FOR dup_record IN
    SELECT name
      FROM enterprises
     WHERE deleted_at IS NULL
     GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id
      FROM enterprises
     WHERE name = dup_record.name
       AND deleted_at IS NULL
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1;

    UPDATE hazards h
       SET enterprise_id = keep_id
      FROM enterprises e
     WHERE h.enterprise_id = e.id
       AND e.name = dup_record.name
       AND e.id <> keep_id
       AND e.deleted_at IS NULL;

    UPDATE enterprises
       SET deleted_at = NOW()
     WHERE name = dup_record.name
       AND deleted_at IS NULL
       AND id <> keep_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "uix_enterprises_name"
    ON "enterprises" ("name")
 WHERE "deleted_at" IS NULL;

COMMIT;
