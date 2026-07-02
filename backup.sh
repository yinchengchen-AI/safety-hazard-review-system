#!/usr/bin/env bash
# Backup the safety_hazard database before any cutover / migration.
# Default: writes to ./backups/ with a timestamped filename; reads
# connection from /etc/safety-hazard.env or DATABASE_URL.
#
# Use this:
#   - Right before cutting over to the TypeScript stack
#   - Before applying any new Prisma migration
#   - After any incident that might have damaged the data
#
# Format is a custom-format pg_dump (-Fc) compressed with gzip; restore
# with ``pg_restore -d safety_hazard <file>``.

set -euo pipefail

REPO_DIR=${REPO_DIR:-$(pwd)}
BACKUP_DIR=${BACKUP_DIR:-$REPO_DIR/backups}
TS=$(date +%Y%m%dT%H%M%S)
FILENAME=${FILENAME:-pre-ts-migration-${TS}.sql.gz}
RETENTION_DAYS=${RETENTION_DAYS:-30}

if [[ -z "${DATABASE_URL:-}" && -f /etc/safety-hazard.env ]]; then
  set -a; source /etc/safety-hazard.env; set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (export it or set /etc/safety-hazard.env)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
DEST="$BACKUP_DIR/$FILENAME"

echo "[backup] target: $DEST"

# We can't exec pg_dump inside an existing container; run it via the
# local pg client (preferred) or via docker run.
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --no-owner --clean --if-exists --format=custom \
    "$DATABASE_URL" | gzip > "$DEST"
else
  docker run --rm \
    -e PGPASSWORD="$(echo "$DATABASE_URL" | sed -E 's|^postgresql://[^:]+:([^@]+)@.*|\1|')" \
    postgres:15-alpine \
    sh -c "pg_dump --no-owner --clean --if-exists --format=custom \"\${DATABASE_URL}\" | gzip > /tmp/backup.sql.gz"
  docker run --rm -v "$BACKUP_DIR:/out" postgres:15-alpine \
    cp /tmp/backup.sql.gz "/out/$FILENAME"
fi

echo "[backup] written: $DEST ($(du -h "$DEST" | cut -f1))"

# Rotate: prune anything older than RETENTION_DAYS
find "$BACKUP_DIR" -maxdepth 1 -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
echo "[backup] retention: ${RETENTION_DAYS} days"

echo "[backup] restore: gunzip -c $DEST | pg_restore -d safety_hazard"
