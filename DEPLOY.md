# 生产部署指南（TypeScript 全栈）

本文描述 2026-Q3 切流后的 TypeScript 全栈部署流程。旧 Python
栈（`backend-legacy/` + `docker-compose.legacy.yml`）保留 30 天
作为回滚预案。

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
- `postgres` (15-alpine, 5432)
- `redis` (7-alpine, 6379)
- `minio` (latest, 9000/9001)
- `backend` (NestJS 10, 8000)
- `worker` (BullMQ consumer + cron jobs)
- `frontend` (Next.js 14 standalone, 3000)
- `nginx` (80，对外唯一入口)

仅 80 端口对外；其它端口绑定 `127.0.0.1`。

## 3. 迁移

```bash
./migrate.sh
```

`backend/prisma/migrations/0_init/` 已经在切换时由 `prisma migrate
resolve --applied 0_init` 标 baseline；本脚本对未来的 `migrate dev`
新增迁移幂等。

## 4. 健康检查 / 监控

- `GET /health` → `{"status":"ok"}`，探测 DB 连通。
- `GET /metrics` → Prometheus 格式（nodejs 默认指标 +
  Prisma 客户端指标），由 PrometheusModule 注册。`@willsoto/nestjs-prometheus` 的 `defaultMetrics.enabled` 默认开。
- 监控接入建议：Nginx 暴露 `/metrics` 给内网 Prometheus scraper；用 BullMQ 队列长度告警（`report_queue.waiting` / `active` / `completed` / `failed`）。

## 5. 切流（Phase 6）

切流窗口（staging 演练过 2 轮后执行）：

1. 备份数据库：`pg_dump -Fc safety_hazard > backups/pre-ts-migration-$(date +%s).sql.gz`
2. 关停旧服务：`docker compose -f docker-compose.legacy.yml stop`
3. 起新服务：`./deploy-remote.sh`（`docker compose -f docker-compose.prod.yml up -d` + migrate）
4. 验证：登录、创建企业、Excel 导入 50 行、创建复核任务、批量通过、生成报告、下载 PDF/Word
5. 切 Nginx upstream（如使用外部 Nginx）：从 `backend-py:8000` 改到 `backend:8000`

回滚预案：
- 保留 `docker-compose.legacy.yml`（绑定 8000）+ 旧 Python 镜像 tag
- 若 5 分钟内 P95 > 2× baseline 或 P0 事故，立即停 prod stack、起
  legacy stack、保留数据库不变。
- 30 天后清理 `backend-legacy/`、`docker-compose.legacy.yml`、
  Python 镜像 tag。

## 6. CI

GitHub Actions 跑：
- 后端：`cd backend && pytest`（沿用 Phase 1 写好的 76 个测试）
- 前端：`cd frontend && npm run build && npm run lint`
- E2E：`cd frontend && npx playwright install --with-deps && npx playwright test`（本地 docker compose 起来 backend + frontend + minio + postgres + redis + worker）
