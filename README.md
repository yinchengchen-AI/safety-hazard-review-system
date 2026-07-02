# 安全生产隐患复核系统 (Safety Hazard Review System)

管理企业安全生产隐患排查 → 任务分派 → 复核 → 报告生成的企业内部系统。

## 技术栈（2026-Q3 切流后）

| 层 | 技术 |
|---|---|
| 后端 | **NestJS 10** + Prisma 5 + TypeScript 5 |
| 前端 | **Next.js 14 App Router** + React 18 + Ant Design 5 + Zustand |
| 队列 | **@nestjs/bullmq** + Redis 7 |
| 数据库 | PostgreSQL 15 |
| 对象存储 | MinIO (S3 兼容) |
| 部署 | Docker Compose + Nginx |

历史栈 (Python/FastAPI + React/Vite) 已退役，源码保留在
`backend-legacy/` 30 天作为回滚预案。

## 快速开始

### 本地开发
```bash
# 后端
cd backend
cp .env.example .env  # 然后填实际值
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev          # http://localhost:8000

# 前端 (另一个终端)
cd frontend
npm install
npm run dev          # http://localhost:3000
```

默认管理员账号 `admin / admin123`，首次登录后请立即修改。

### 测试
```bash
# 后端 (单测 + E2E)
cd backend
npm test
npm run test:e2e       # 需要本地 Postgres / Redis / MinIO

# 前端
cd frontend
npm run build
npm run lint
npm run test:e2e       # Playwright（需要先 npx playwright install）
```

### 生产部署
见 [DEPLOY.md](DEPLOY.md)。`./init-env.sh` 生成强随机密码，
`./deploy-remote.sh` 拉代码、build 镜像、跑 Prisma migrate、
重启 stack。

## 目录结构

```
.
├── backend/              # NestJS API + worker entrypoint
│   ├── src/
│   │   ├── modules/      # auth / users / enterprises / hazards / batches / ...
│   │   ├── queues/       # BullMQ producer + consumer + cron jobs
│   │   ├── storage/      # S3/MinIO 客户端 + URL signer
│   │   └── common/       # guards / interceptors / filters / decorators
│   ├── prisma/           # schema.prisma + migrations/0_init
│   └── test/             # jest E2E
├── frontend/             # Next.js 14 SPA
│   ├── src/app/          # (dashboard) 路由组 + /login
│   ├── src/lib/          # api / auth / userStore / notificationStore
│   └── e2e/              # Playwright 端到端
├── backend-legacy/       # 旧 Python 栈（仅回滚用，30 天内清理）
├── docker-compose.prod.yml
├── docker-compose.legacy.yml
├── nginx.conf
├── init-env.sh           # 一次性：生成 /etc/safety-hazard.env
├── migrate.sh            # 跑 prisma migrate deploy
└── deploy-remote.sh      # 拉代码 → build → migrate → restart
```

## API 契约

`/api/v1/*` 与原 Python 端 1:1 兼容；详见 `docs/superpowers/specs/2026-06-22-fullstack-migration-design.md`。

## 安全

- 鉴权：JWT in httpOnly cookie（`SameSite=Lax`，生产 `Secure`），bcrypt cost=12 透明 rehash
- 启动期 `assert_safe_for_runtime`：staging/production 阻断默认 admin / 弱密钥
- 图片：HMAC-SHA256 签名 URL（`?sig=&exp=`），15 分钟 TTL
- 限流：slowapi 5/min/IP（login）、60/min（其他）
- Nginx 安全头：CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy

## License

Internal use only.
