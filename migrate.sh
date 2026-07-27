#!/usr/bin/env bash
# Apply Prisma migrations to the running database.
# Phase 1 baseline (0_init) is already applied; this script is
# idempotent for future migrations added to apps/backend/prisma/migrations/.

set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f /etc/safety-hazard.env ]]; then
    set -a; source /etc/safety-hazard.env; set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (export it or set /etc/safety-hazard.env)" >&2
  exit 1
fi

echo "[migrate] DATABASE_URL=$DATABASE_URL"

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -v "$(pwd)/apps/backend/prisma:/app/apps/backend/prisma" \
  -w /app/apps/backend \
  --network host \
  node:20-alpine \
  sh -c "npx prisma@5 migrate deploy"
