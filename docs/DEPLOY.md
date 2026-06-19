# 部署指南 (Deployment Guide)

> 安全生产隐患复核系统 v0.1 生产部署文档。  
> 面向运维 / 系统集成方，覆盖 Docker 全栈、混合部署、纯 Node 进程三种形态，以及 HTTPS / 备份 / 监控 / 升级。

## 目录

- [1. 部署总览](#1-部署总览)
- [2. 硬件与系统要求](#2-硬件与系统要求)
- [3. 部署方式](#3-部署方式)
  - [3.1 方式 A：Docker Compose 全栈（推荐）](#31-方式-adocker-compose-全栈推荐)
  - [3.2 方式 B：Docker app + 外部 PG / MinIO](#32-方式-bdocker-app--外部-pg--minio)
  - [3.3 方式 C：纯 Node 进程 + 外部服务](#33-方式-c纯-node-进程--外部服务)
- [4. 环境变量](#4-环境变量)
- [5. 反向代理与 HTTPS](#5-反向代理与-https)
- [6. MinIO Bucket 初始化](#6-minio-bucket-初始化)
- [7. 数据库迁移与种子](#7-数据库迁移与种子)
- [8. 进程内 Cron 注意事项](#8-进程内-cron-注意事项)
- [9. PWA 注意事项](#9-pwa-注意事项)
- [10. 备份策略](#10-备份策略)
- [11. 监控与日志](#11-监控与日志)
- [12. 故障排查](#12-故障排查)
- [13. 升级流程](#13-升级流程)
- [14. 卸载 / 清理](#14-卸载--清理)

## 1. 部署总览

本系统由三个组件构成：

| 组件                  | 作用                                      | 端口                        |
| --------------------- | ----------------------------------------- | --------------------------- |
| **app**（Next.js 15） | 业务主进程、UI、API、Service Worker、Cron | 3000                        |
| **PostgreSQL 16**     | 主数据存储（Prisma 6）                    | 5432                        |
| **MinIO**             | 照片 / 附件对象存储（S3 兼容）            | 9000（API）/ 9001（控制台） |

**拓扑示意**：

```
                    ┌────────────────────┐
   用户 / PWA  ───► │  Nginx / Caddy     │ ──►  app :3000
                    │  （HTTPS 终结）    │
                    └────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
        ┌──────────────────┐         ┌──────────────────┐
        │  PostgreSQL 16   │         │      MinIO       │
        │  :5432           │         │  :9000  / :9001  │
        └──────────────────┘         └──────────────────┘
```

`app` 同时承载 **HTTP 业务**、**Service Worker**（PWA 离线）、**node-cron**（08:00 临期扫描、02:00 失活锁回收）。**因此推荐单实例部署**；多实例需先解决 cron 锁问题（见 §8）。

## 2. 硬件与系统要求

| 项       | 最低                                               | 推荐（50 并发监管员 + 50 并发科长） |
| -------- | -------------------------------------------------- | ----------------------------------- |
| CPU      | 2 vCPU                                             | 4 vCPU                              |
| 内存     | 4 GB                                               | 8 GB                                |
| 磁盘     | 40 GB SSD                                          | 100 GB SSD（按 3 年照片增长估算）   |
| OS       | Linux x86_64（Debian 12 / Ubuntu 22.04+ / RHEL 9） | 同左                                |
| Docker   | 24.0+                                              | 24.0+                               |
| Node     | 20 LTS（仅方式 C 需要本机安装）                    | 20 LTS                              |
| 反向代理 | Nginx 1.24+ / Caddy 2.7+                           | Nginx 1.24+                         |

PostgreSQL 与 MinIO **必须**与应用服务器时间同步（`Asia/Shanghai`），建议部署 NTP。

## 3. 部署方式

### 3.1 方式 A：Docker Compose 全栈（推荐）

适合测试 / 验收 / 小规模生产环境。一次性把 PG、MinIO、app 全部容器化。

```bash
# 1. 拉取代码
git clone git@github.com:yinchengchen-AI/safety-hazard-review-system.git
cd safety-hazard-review-system

# 2. 复制并修改环境变量
cp .env.example .env
$EDITOR .env
#    至少改：NEXTAUTH_SECRET（32 字节随机）、NEXTAUTH_URL、MINIO_* 凭据
#    TZ 必须设为 Asia/Shanghai

# 3. 启动全栈
docker compose --profile all up -d

# 4. 观察启动日志（app 容器会自动跑 prisma migrate deploy + npm start）
docker compose logs -f app
```

`app` 服务在 `Dockerfile` 的 `CMD` 阶段执行 `npx prisma migrate deploy && npm run start`，**首次启动需等待约 30 秒** 完成 schema 迁移再监听 3000。

健康检查：

```bash
curl -s http://localhost:3000/api/health | jq
# 期望：{ "ok": true, "checks": { "postgres": "ok", "minio": "ok" } }
```

**MinIO 桶初始化**（首次）：见 §6。

### 3.2 方式 B：Docker app + 外部 PG / MinIO

适合政务专网环境 — 数据库 / 对象存储由甲方既有基础设施提供，仅容器化应用。

```bash
# 1. 准备外部 PG（要求 PG 13+）与 MinIO（任意版本，兼容 S3 v4 签名）
#    由甲方提供：DATABASE_URL / MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY

# 2. 启动 app（不含 PG / MinIO）
DATABASE_URL='postgresql://shr:***@10.0.0.5:5432/shr?schema=public' \
NEXTAUTH_SECRET='<32字节随机>' \
NEXTAUTH_URL='https://shr.example.gov.cn' \
MINIO_ENDPOINT='10.0.0.6' \
MINIO_PORT=9000 \
MINIO_ACCESS_KEY='***' \
MINIO_SECRET_KEY='***' \
MINIO_BUCKET='shr-photos' \
TZ='Asia/Shanghai' \
docker compose up -d app
```

**前置条件**：

- `app` 容器能访问 `10.0.0.5:5432` 与 `10.0.0.6:9000`。
- 外部 MinIO 已创建 `shr-photos` 桶（§6）。
- 如外部 PG 与 MinIO 处于不同子网，需提前打 `docker network connect`。

### 3.3 方式 C：纯 Node 进程 + 外部服务

适合不能上容器的国产化平台（信创栈）。

```bash
# 1. 安装 Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. 拉代码 + 装依赖
git clone git@github.com:yinchengchen-AI/safety-hazard-review-system.git
cd safety-hazard-review-system
npm ci --omit=dev   # 生产环境只装 prod deps

# 3. 生成 prisma client
npx prisma generate

# 4. 配置 .env
cp .env.example .env
$EDITOR .env

# 5. 跑迁移 + 种子（首次）
npx prisma migrate deploy
npm run db:seed

# 6. 启动（推荐交给 systemd / pm2）
npm run build   # 提前一次性构建
npm start       # next start -p 3000
```

**systemd 单元示例**（`/etc/systemd/system/shr.service`）：

```ini
[Unit]
Description=Safety Hazard Review System
After=network.target

[Service]
Type=simple
User=shr
WorkingDirectory=/opt/safety-hazard-review-system
EnvironmentFile=/opt/safety-hazard-review-system/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/shr/app.log
StandardError=append:/var/log/shr/app.log

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shr
sudo systemctl status shr
```

## 4. 环境变量

完整列表见 [`.env.example`](../.env.example)。生产环境**必须**改以下三项：

| 变量                                    | 说明                    | 生产建议                                                                     |
| --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Postgres 连接串         | `postgresql://shr:<强密码>@<pg-host>:5432/shr?schema=public&sslmode=require` |
| `NEXTAUTH_SECRET`                       | NextAuth JWT 签名密钥   | `openssl rand -hex 32` 生成，**至少 32 字节**，禁止复用示例值                |
| `NEXTAUTH_URL`                          | 站点公网 URL            | `https://shr.example.gov.cn`（无尾斜杠）                                     |
| `MINIO_ENDPOINT` / `MINIO_PORT`         | MinIO 地址              | 内部域名或 IP                                                                |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO 凭据              | **必须改**，禁止 `minio` / `minio_dev_pwd`                                   |
| `MINIO_BUCKET`                          | 照片桶名                | 单独桶，便于备份与权限隔离                                                   |
| `TZ`                                    | 时区                    | **必须** `Asia/Shanghai`（cron 与时间字段依赖）                              |
| `SYNC_BASE_URL`                         | 客户端同步回调 base URL | 与 `NEXTAUTH_URL` 一致                                                       |
| `LOG_LEVEL`（可选）                     | pino 日志级别           | `info`（默认）/ `debug` 排障时临时改                                         |

**安全提醒**：

- `.env` 禁止提交 git；`AGENTS.md` 已强调。
- Docker 方式下，强烈建议把 `NEXTAUTH_SECRET` 写入 `.env` 而非 `-e` 传参，避免泄漏到 `docker inspect` 历史。
- 政务专网如需国密 SM4 加密静态字段，需在 Prisma 层做应用加密（本系统未内置）。

## 5. 反向代理与 HTTPS

PWA Service Worker **必须 HTTPS**（localhost 除外），否则浏览器不注册 SW，离线功能失效。强烈建议终结在反代。

### 5.1 Nginx 示例

```nginx
# /etc/nginx/sites-available/shr.conf
upstream shr_app {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name shr.example.gov.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shr.example.gov.cn;

    ssl_certificate     /etc/letsencrypt/live/shr.example.gov.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shr.example.gov.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;     # 照片上传上限

    # Service Worker 必须 no-transform、不缓存
    location = /sw.js {
        proxy_pass http://shr_app;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Service-Worker-Worker "/sw.js" always;
    }

    location = /manifest.webmanifest {
        proxy_pass http://shr_app;
        add_header Cache-Control "no-cache" always;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://shr_app;
    }
}
```

### 5.2 Caddy 示例（自动 HTTPS）

```caddy
shr.example.gov.cn {
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
    encode zstd gzip
}
```

## 6. MinIO Bucket 初始化

首次部署需在 MinIO 中创建 `shr-photos` 桶，并设置合理的访问策略。

### 6.1 用 `mc` CLI（推荐）

```bash
# 配置 mc 别名
mc alias set local http://<minio-host>:9000 <access-key> <secret-key>

# 创建桶
mc mb local/shr-photos

# 设为私有（照片访问通过预签名 URL，禁止公开读）
mc anonymous set none local/shr-photos
```

### 6.2 用 MinIO 控制台

访问 `http://<minio-host>:9001`，用 root 账号登录 → Buckets → Create Bucket → 名称 `shr-photos` → Access Policy 选 `Private`。

### 6.3 应用层验证

启动 app 后调用 `GET /api/health`：

```bash
curl -s https://shr.example.gov.cn/api/health | jq .checks.minio
# 期望 "ok"
```

## 7. 数据库迁移与种子

### 7.1 迁移

- **首次**：`npx prisma migrate deploy`（应用所有 `prisma/migrations/` 下未执行过的迁移）。
- **升级**：同命令，幂等。
- **Docker 方式**：`app` 容器启动时自动执行。

### 7.2 种子

种子脚本 `prisma/seed.ts` 创建 **4 个演示账号 + 1 个示范企业 + 4 个隐患类型 + 1 个消防复核清单**：

| 邮箱                    | 角色        | 密码          |
| ----------------------- | ----------- | ------------- |
| `inspector@example.com` | `INSPECTOR` | `password123` |
| `chief@example.com`     | `CHIEF`     | `password123` |
| `director@example.com`  | `DIRECTOR`  | `password123` |
| `admin@example.com`     | `ADMIN`     | `password123` |

执行：

```bash
npm run db:seed
```

> **生产环境上线后务必在管理后台改密码或删除种子账号**。

## 8. 进程内 Cron 注意事项

`src/instrumentation.ts` 在 Next.js 启动时注册两个 cron（08:00 临期扫描 / 02:00 失活锁回收）：

```ts
registerCron('scanDeadlines', '0 8 * * *', scanDeadlines);
registerCron('scanRecycle', '0 2 * * *', scanRecycle);
```

注册日志格式：`{ "name": "scanDeadlines", "schedule": "0 8 * * *" }`（`src/lib/cron.ts`）。

**约束**：

1. **单实例部署** — 多实例同时跑 cron 会导致重复通知 / 重复释放。**绝对不要把 `app` 容器 scale > 1**。
2. 如必须多实例（横向扩容），方案：
   - 引入 `pg_advisory_lock` 包装 cron 入口（修改 `src/lib/cron.ts`）；
   - 或拆出独立的 `cron` 容器跑 `node src/workers/run-cron.ts`（需新增入口，本系统未提供）；
   - 或外接系统级 scheduler（k8s CronJob / crontab）通过 HTTP 触发对应 endpoint（需新增 API）。
3. **时区** — `TZ` 必须 `Asia/Shanghai`，否则 cron 触发时间偏移。

## 9. PWA 注意事项

- `next.config.ts` 中 `disable: process.env.NODE_ENV === 'development'` — **开发环境 PWA 不启用**，避免 Service Worker 缓存脏数据。
- 生产构建后 `public/sw.js` 自动生成，由反代配置 §5.1 中的 `Cache-Control: no-store` 保护不被中间层缓存。
- iOS Safari 对 SW 限制较多（必须用户主动添加到主屏幕才能用全部离线能力），部署到移动监管员前需做真机验收。
- **升级后** 首次访问会自动激活新版 SW（`reloadOnOnline: true`）；如需强刷，把 `sw.js` 文件名 bump 一次即可（修改 `next.config.ts` 的 `workboxOptions` 即可）。

## 10. 备份策略

### 10.1 PostgreSQL

每日凌晨 `pg_dump` 全量 + 保留 14 天滚动：

```bash
# /etc/cron.d/shr-pg-backup
0 3 * * * postgres pg_dump -Fc -d shr -f /backup/pg/shr-$(date +\%Y\%m\%d).dump
0 4 * * * postgres find /backup/pg -name 'shr-*.dump' -mtime +14 -delete
```

恢复演练（每季度）：

```bash
createdb shr_restore
pg_restore -d shr_restore /backup/pg/shr-20260101.dump
```

### 10.2 MinIO

桶内为不可变 blob，启用 MinIO 服务端版本控制 + 跨桶复制到异地：

```bash
# 启用版本控制
mc version enable local/shr-photos

# 镜像到异地（异地 MinIO）
mc mirror --remove local/shr-photos remote/shr-photos-mirror
```

### 10.3 应用配置

`.env` 与 `next.config.ts` 纳入配置管理（Ansible / etcd / 私有 Git 仓库均可），**禁止**只存在于某台机器。

## 11. 监控与日志

### 11.1 健康检查

`GET /api/health` 同时探测 PG 与 MinIO：

```json
{ "ok": true, "checks": { "postgres": "ok", "minio": "ok" } }
```

失败返回 `503`。可对接：

- **Docker**：内置 `HEALTHCHECK`（`Dockerfile` 已配，30s 间隔）。
- **Kubernetes**：livenessProbe / readinessProbe 指 `/api/health`。
- **外部监控**：Zabbix / Prometheus blackbox_exporter。

### 11.2 应用日志

`pino` 结构化 JSON 日志，字段 `app: "shr"`。关键事件：

| 事件                                      | 含义                            |
| ----------------------------------------- | ------------------------------- |
| `cron:registered { name, schedule }`      | cron 注册成功（启动时各打一条） |
| `cron:start` / `cron:done` / `cron:error` | cron 任务执行生命周期           |
| 业务日志字段由 `src/lib/log.ts` 统一封装  |                                 |

**日志采集**：

- Docker：`docker logs` 或挂 `/var/lib/docker/containers` 给 Filebeat。
- 进程：systemd journal 或 `>> /var/log/shr/app.log`。

### 11.3 指标

v0.1 未内置 `/metrics`（Prometheus）。如需：

- 短期：在 cron 任务里追加 `console.log` 关键计数；
- 中期：新增 `prom-client`，在 `/api/metrics` 暴露。

## 12. 故障排查

| 现象                                                           | 根因                                | 解决                                                                                       |
| -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `app` 容器反复重启，`/api/health` 报 `postgres` 字段为连接错误 | `DATABASE_URL` 错误 / PG 不可达     | 容器内 `docker exec shr-app-1 npx prisma db pull` 验证；确认网络与密码                     |
| `/api/health` 报 `minio: NoSuchBucket`                         | `MINIO_BUCKET` 未创建               | §6 创建桶                                                                                  |
| 登录后页面 404 / 跳转回登录                                    | `NEXTAUTH_URL` 与实际访问域名不一致 | 改 `.env` 里的 `NEXTAUTH_URL`，重启 app                                                    |
| PWA 安装按钮不见                                               | 非 HTTPS / Service Worker 异常      | 确认反代终止 TLS；`/sw.js` 直连能 200；DevTools → Application → Service Workers 看注册状态 |
| Cron 没触发                                                    | 时区错 / 进程被重启打断             | 确认 `TZ=Asia/Shanghai`；查启动日志有 `cron:registered`                                    |
| 照片上传 413                                                   | 反代 `client_max_body_size` 太小    | §5.1 Nginx 改为 ≥ 20M                                                                      |
| 离线草稿无法同步                                               | 客户端 IndexedDB 损坏               | 浏览器 DevTools → Application → Storage → Clear site data，让用户重登                      |
| 监管员账号登录后看不到列表                                     | 角色权限矩阵不匹配                  | 查 `User.role` 枚举值与 `src/lib/permissions.ts` 是否一致                                  |

## 13. 升级流程

```bash
# 1. 备份（即使是小版本也建议先备份）
pg_dump -Fc -d shr -f /backup/pre-upgrade-$(date +%Y%m%d).dump
mc version info local/shr-photos  # 记录当前对象数量

# 2. 拉取新代码
git pull origin main

# 3. 更新依赖
npm ci

# 4. 跑迁移（生产禁用 dev 迁移）
npx prisma migrate deploy

# 5. 重新构建
npm run build

# 6. 重启服务
#    Docker:  docker compose up -d --build app
#    systemd: sudo systemctl restart shr
#    PM2:     pm2 restart shr

# 7. 验证
curl -s https://shr.example.gov.cn/api/health
```

**回滚**：用第 1 步的 dump 恢复 DB，`git checkout` 旧版本代码后重新构建即可。

## 14. 卸载 / 清理

```bash
# Docker 方式
docker compose --profile all down         # 停服 + 删容器
docker compose --profile all down -v      # 连数据卷一起删（**慎用**）

# 手动方式
sudo systemctl disable --now shr
sudo rm /etc/systemd/system/shr.service
```

外部 PG / MinIO 桶与数据需另行清理。
