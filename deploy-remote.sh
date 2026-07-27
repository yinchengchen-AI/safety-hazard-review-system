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

echo "[deploy] starting postgres (needed by migrations on fresh hosts)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' safety-pg 2>/dev/null || echo starting)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
[[ "$status" == "healthy" ]] || { echo "postgres did not become healthy" >&2; exit 1; }

echo "[deploy] running migrations"
"$REPO_DIR/migrate.sh"

echo "[deploy] restarting stack"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
