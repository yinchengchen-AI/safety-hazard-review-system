#!/usr/bin/env bash
# Remote deploy script: pulls latest images, runs Prisma migrate
# deploy, restarts the prod stack. Idempotent and safe to re-run.
# Requires the env file at /etc/safety-hazard.env to exist.
set -euo pipefail

REPO_DIR=${REPO_DIR:-/opt/safety-hazard-review-system}
ENV_FILE=${ENV_FILE:-/etc/safety-hazard.env}
COMPOSE_FILE=${COMPOSE_FILE:-$REPO_DIR/docker-compose.prod.yml}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE" >&2
  exit 1
fi

cd "$REPO_DIR"

echo "[deploy] pulling latest"
git pull --ff-only

echo "[deploy] building images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "[deploy] running migrations"
"$REPO_DIR/migrate.sh"

echo "[deploy] restarting stack"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
