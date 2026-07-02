# TypeScript 全栈切流 runbook

> 日期：2026-07-02  
> 执行窗口：23:00 - 01:00（低峰，2 小时）  
> 总目标：30 分钟内完成切换，5 分钟内可回滚。  
> 涉及系统：safety-hazard-review-system（生产）  
> 切流方式：硬切（hard cut），不回滚到中间状态。

## 0. 前置条件（执行前 24 小时）

- [ ] staging 完成 2 轮切流演练，回滚 < 5 min ✅
- [ ] 旧 Python 服务镜像已 tag `safety-backend-py:py-pre-ts-migration`
- [ ] 新 TypeStack 镜像已 build 并 push 到镜像仓库
- [ ] 监控大盘（Grafana）已配置 alert：API 5xx > 1%、P95 > 2× baseline、BullMQ queue waiting > 100
- [ ] 通知渠道就绪：#incident-ops Slack channel
- [ ] 值班人：1 切流执行 + 1 监控（至少 2 人）

## 1. 备份（T-30 min, 22:30）

```bash
cd /opt/safety-hazard-review-system
./backup.sh
# expected: backups/pre-ts-migration-20260702T223000.sql.gz ~ 50MB
# 验证：gunzip -c backups/pre-ts-migration-20260702T223000.sql.gz | pg_restore --list | head
ls -la backups/
```

## 2. 停止旧 Python 服务（T-5 min, 22:55）

```bash
cd /opt/safety-hazard-review-system
docker compose -f docker-compose.legacy.yml stop backend-py celery-py
docker compose -f docker-compose.legacy.yml ps
# expected: 旧 backend-py / celery-py 状态 Exited (0)
```

保留 `docker-compose.legacy.yml` 不删，作为回滚预案。

## 3. 跑 Prisma migration（22:58）

```bash
./migrate.sh
# 跑 prisma migrate deploy；Phase 1 的 0_init 已标 baseline，
# 后续迁移（如果有）会按顺序执行
# expected: "All migrations have been successfully applied."
```

## 4. 启动新 TypeScript stack（22:59）

```bash
cd /opt/safety-hazard-review-system
docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d
# expected: 7 个服务 Up；nginx 80 端口就绪
docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env ps
```

## 5. 验证（T+5 min, 23:05）

按顺序跑（每条 5 秒超时）：

```bash
# 5.1 健康检查
curl -fsS http://localhost/health
# expected: {"status":"ok"}

# 5.2 登录
curl -fsS -c /tmp/cookies.txt -X POST http://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<env-password>"}'
# expected: 200 + Set-Cookie: access_token=...; HttpOnly; SameSite=Lax

# 5.3 当前用户
curl -fsS -b /tmp/cookies.txt http://localhost/api/v1/auth/me
# expected: {"id":"...","username":"admin","role":"admin","is_active":true}

# 5.4 业务冒烟：选一个现有批次
curl -fsS -b /tmp/cookies.txt 'http://localhost/api/v1/batches?page=1&page_size=5' | head -c 200
# expected: 200 + 真实数据

# 5.5 统计冒烟
curl -fsS -b /tmp/cookies.txt http://localhost/api/v1/statistics/overview
# expected: 200 + total_hazards / pending_count / coverage_rate

# 5.6 /metrics
curl -fsS http://localhost/metrics | head -5
# expected: 200 + Prometheus 指标
```

任一失败 → 跳到 §7 回滚。

## 6. 切 Nginx upstream（T+10 min, 23:10）

如果使用外部 Nginx 而非 docker 内置的 nginx 容器：

```bash
# 编辑 /etc/nginx/conf.d/safety-hazard.conf
# upstream safety_api { server backend:8000; }   # was backend-py:8000
nginx -t && nginx -s reload
curl -fsS http://<public-host>/health
# expected: 200
```

## 7. 回滚预案（任一验证失败）

```bash
# 7.1 停 prod stack
docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env down
# 不删 volumes（MinIO 照片、Postgres 数据都在）

# 7.2 起旧 Python 服务
docker compose -f docker-compose.legacy.yml up -d
# expected: backend-py / celery-py Up

# 7.3 验证
curl -fsS -c /tmp/cookies.txt -X POST http://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<env-password>"}'
# expected: 200（同旧服务）

# 7.4 写 incident 报告
echo "TS cutover rolled back at $(date -Iseconds)" | tee -a incidents.log
```

## 8. 24h 监控（T+24h）

切流后 24 小时盯这几个指标：

| 指标 | 来源 | 阈值 |
|---|---|---|
| 5xx rate | nginx access log → Prometheus | > 1% |
| API P95 latency | `/metrics` (http_request_duration_seconds histogram) | > 2× pre-cut baseline |
| BullMQ report-queue waiting | `/metrics` queue gauges | > 100 |
| Default admin login attempts | audit_logs | any (should be 0) |
| Prisma connection pool errors | app log | any |

切流 24h 后无 P0/P1 事故 → 关闭本次切流事件 → 30 天后清理
`backend-legacy/`、`docker-compose.legacy.yml`、旧 Python 镜像。

## 9. 联系人

- 切流执行：[name]
- 监控值班：[name]
- 升级路径：#incident-ops → on-call lead → engineering manager
