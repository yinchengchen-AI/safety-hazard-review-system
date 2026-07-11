# 生产部署指南（TypeScript 全栈）

本文描述本仓库的生产部署流程。部署基于 Docker Compose + Nginx，
后端是 NestJS 10 + Prisma 5（Node 20），前端是 Next.js 14 App Router。

## 1. 一次性初始化

```bash
# 在目标服务器上：
git clone <repo-url> /opt/safety-hazard-review-system
cd /opt/safety-hazard-review-system
./init-env.sh   # 生成 /etc/safety-hazard.env（强随机密码 / SECRET_KEY）
```

生成的 `SECRET_KEY` 至少 32 字符；启动期 `assert_safe_for_runtime`
会在 staging/production 下二次校验：若 `SECRET_KEY` 是占位串或
< 32 字符，启动直接抛 `RuntimeError`。

## 2. 启动

```bash
docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env build
docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d
```

启动的服务：
- `postgres` (16-alpine, 5432)
- `redis` (7-alpine, 6379)
- `minio` (latest, 9000/9001)
- `backend` (NestJS 10, 8000)
- `worker` (BullMQ consumer + cron jobs)
- `frontend` (Next.js 14 standalone, 3000)
- `nginx` (80，对外唯一入口)

仅 80 端口对外；其它端口绑定 `127.0.0.1`。

## 3. 数据库迁移

```bash
./migrate.sh
```

`apps/backend/prisma/migrations/0_init/` 是 baseline 迁移（已在初始部署时通过 `prisma migrate resolve --applied` 标 baseline）；后续 `migrate dev` 生成的迁移由本脚本幂等执行 `prisma migrate deploy`。

## 4. 健康检查 / 监控

- `GET /health` → `{"status":"ok"}`，探测 DB 连通（Prisma `$queryRaw SELECT 1`）。
- `GET /metrics` → Prometheus 格式（nodejs 默认指标 + Prisma 客户端指标），由 `@willsoto/nestjs-prometheus` 注册。`defaultMetrics.enabled` 默认开。
- 监控接入建议：Nginx 暴露 `/metrics` 给内网 Prometheus scraper；同时按 BullMQ 队列长度告警（`report_queue.waiting` / `active` / `completed` / `failed`）。

## 5. 常规运维

日常操作：
- **更新代码**：`git pull` 后 `./deploy-remote.sh`（自动 build + migrate + restart）。详见该脚本说明。
- **回看日志**：`docker compose -f docker-compose.prod.yml logs -f <service>`，常见 service：`backend` / `worker` / `nginx`。
- **备份数据库**：`backup.sh` 已挂在生产 cron，每日凌晨 02:30 `pg_dump --no-owner --clean --if-exists -Fc` 落到 `backups/`，30 天轮转。
- **撤销一次发布**：参考 `docs/runbooks/` 下的应急响应文档。

## 6. CI

GitHub Actions `.github/workflows/ci.yml` 跑：
- 后端：`cd apps/backend && npm ci && npx prisma migrate deploy && npm test && npm run build`（需要 Postgres 5433 + Redis，CI service 容器提供）
- 前端：`cd apps/frontend && npm ci && npm run build && npm run lint`
- 触发：push / PR 到 `master` 与 `feat/fullstack-ts`。
