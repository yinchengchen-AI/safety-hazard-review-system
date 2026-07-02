#!/usr/bin/env bash
# One-time / per-server setup: generate strong passwords, write the env
# file used by docker-compose.prod.yml and migrate.sh.
# Idempotent: re-running preserves existing values.

set -euo pipefail
ENV_FILE=${ENV_FILE:-/etc/safety-hazard.env}

ensure() {
  local key=$1
  local value=$2
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "[init] keep $key"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    echo "[init] set $key"
  fi
}

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

ensure POSTGRES_USER postgres
ensure POSTGRES_PASSWORD "$(openssl rand -hex 16)"
ensure POSTGRES_DB safety_hazard
ensure MINIO_ROOT_USER minioadmin
ensure MINIO_ROOT_PASSWORD "$(openssl rand -hex 16)"
ensure MINIO_BUCKET hazard-photos
ensure SECRET_KEY "$(openssl rand -hex 32)"
ensure ALLOWED_ORIGINS http://localhost

echo "[init] done. env at $ENV_FILE"
