# AGENTS.md

本文件面向 AI 编程助手，提供项目的完整上下文、架构说明与开发规范。

---

## 项目概述

**安全生产隐患复核系统** —— 一个管理企业安全隐患排查、任务分配与复核闭环的全栈 Web 应用。

核心功能模块：
- **企业管理** — 多企业、多区域支持
- **隐患管理** — 批量导入（Excel）、分级分类、图片上传
- **复核任务** — 任务分配、状态流转、闭环跟踪
- **报告生成** — BullMQ 异步生成 PDF / Word 报告（Playwright + docx）
- **统计分析** — 日/月维度数据汇总与图表展示
- **用户权限** — JWT cookie 认证、管理员/普通用户角色分离
- **操作审计** — 全链路操作日志记录（`audit_logs` 表）
- **系统通知** — 任务/复核/报告状态变更实时通知（导航栏铃铛 + 通知中心）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js 20 / TypeScript 5、NestJS 10、Prisma 5（async client） |
| 前端 | Next.js 14（App Router）、React 18、TypeScript 5、Ant Design 5 |
| 状态管理 | Zustand |
| 后台任务 | BullMQ 5（@nestjs/bullmq）+ Redis 7 |
| 数据库 | PostgreSQL 16 |
| 对象存储 | MinIO（S3 兼容，使用 AWS SDK v3） |
| 部署 | Docker Compose + Nginx |
| 测试 | Jest 29（后端 E2E），Playwright（前端 E2E） |
| 监控 | @willsoto/nestjs-prometheus（`/metrics`） |

---

## 项目结构

```
.
├── apps/
│   ├── backend/                         # NestJS 10 API + Worker
│   │   ├── src/
│   │   │   ├── main.ts                  # HTTP 入口（NestFactory.create + Cookie + CORS）
│   │   │   ├── app.module.ts            # 根模块，组装所有业务模块
│   │   │   ├── common/                  # 过滤器、守卫、拦截器、装饰器、startup-checks
│   │   │   ├── config/                  # 环境变量校验（zod schema）+ ConfigModule
│   │   │   ├── prisma/                  # PrismaClient 注入 + 软删除扩展
│   │   │   ├── storage/                 # MinIO/S3 客户端 + URL 签名器
│   │   │   ├── queues/                  # BullMQ producer + consumer + worker entrypoint
│   │   │   └── modules/                 # 业务模块（每个含 controller/service/dto）
│   │   │       ├── auth/                # 登录、JWT、当前用户、密码 rehash
│   │   │       ├── users/               # 用户 CRUD + 管理员重置密码
│   │   │       ├── enterprises/         # 企业 / 区域
│   │   │       ├── hazards/             # 隐患 CRUD + Excel 导入
│   │   │       ├── batches/             # 批次历史 + Excel 失败明细
│   │   │       ├── review-tasks/        # 复核任务分配 + 状态流转
│   │   │       ├── photos/              # 图片上传 + HMAC 签名短链
│   │   │       ├── reports/             # 报告生成（PDF + Word）
│   │   │       ├── notifications/       # 站内通知 CRUD + 已读
│   │   │       ├── statistics/          # 日 / 月统计 + 概览
│   │   │       ├── audit-logs/          # 审计日志查询
│   │   │       └── health/              # /health 探活（prisma $queryRaw SELECT 1）
│   │   ├── prisma/
│   │   │   ├── schema.prisma            # 数据库 schema（14 张表：8 张带 deleted_at，6 张为日志/统计/历史）
│   │   │   ├── migrations/0_init        # baseline 迁移
│   │   │   └── seed.ts                  # 初始管理员种子
│   │   ├── test/                        # Jest E2E（每个模块一个 *.e2e-spec.ts）
│   │   ├── Dockerfile                   # API 镜像（dist/src/main.js）
│   │   ├── Dockerfile.worker            # BullMQ worker 镜像（dist/queues/worker.js）
│   │   └── package.json
│   └── frontend/                        # Next.js 14 App Router
│       ├── src/
│       │   ├── app/                     # App Router 路由
│       │   │   ├── layout.tsx           # 全局 AntD 主题 + Providers
│       │   │   ├── login/page.tsx       # 登录页
│       │   │   └── (dashboard)/         # 已登录路由组（含共享 layout）
│       │   │       ├── page.tsx         # 仪表盘
│       │   │       ├── hazards/         # 隐患列表 + 详情
│       │   │       ├── batches/         # 批次列表 + 导入页 + 历史
│       │   │       ├── tasks/           # 复核任务列表 + 详情
│       │   │       ├── enterprises/     # 企业管理
│       │   │       ├── statistics/      # 统计 + 图表
│       │   │       ├── users/           # 用户管理（管理员）
│       │   │       ├── audit-logs/      # 审计日志（管理员）
│       │   │       └── notifications/   # 通知中心
│       │   └── lib/
│       │       ├── api.ts               # axios 实例：拦截 401，统一错误处理
│       │       ├── auth.ts              # login / getMe / logout
│       │       ├── errors.ts            # 英文错误 → 中文提示映射表
│       │       ├── userStore.ts         # Zustand：当前用户
│       │       └── notificationStore.ts # Zustand：未读通知 + 轮询
│       ├── e2e/                         # Playwright 用例
│       ├── Dockerfile                   # Next.js standalone build
│       └── package.json
├── docs/                                # 设计稿 / 演练 runbook / 计划文档
│   ├── PHASE6_STATUS.md                 # 6 阶段迁移收尾状态表
│   ├── runbooks/2026-07-02-ts-cutover.md
│   └── superpowers/{plans,specs}/...
├── docker-compose.yml                   # 本地开发（端口全暴露）
├── docker-compose.prod.yml              # 生产（仅 80 对外，其余 127.0.0.1）
├── nginx.conf                           # 生产反代（注入安全头）
├── migrate.sh                           # prisma migrate deploy（基于容器化 node:20-alpine）
├── init-env.sh                          # 一次性生成 /etc/safety-hazard.env
├── deploy-remote.sh                     # 拉代码 + build + migrate + restart
├── auto-deploy.py                       # 本地 SSH 一键部署到腾讯云
├── DEPLOY.md                            # 生产部署指南
└── README.md                            # 项目介绍 + 快速开始
```

---

## 后端架构细节

### 模块化拆分
- 每个业务领域是一个独立 NestJS Module（`modules/<domain>/<domain>.module.ts`）
- Module 内部遵循 `controller → service → repository` 三层
- Controller 仅做参数校验（`@Body()` + `class-validator`）和权限守卫
- Service 持有业务逻辑，跨模块依赖通过其它 Module 的 service 注入

### 数据库（Prisma）
- 所有表在 `apps/backend/prisma/schema.prisma` 定义，使用 UUID 主键 + `created_at` / `updated_at` / `deleted_at`（软删除）。
- PrismaClient 由 `PrismaModule` 提供给全应用，**不在 service 里直接 new**。
- 测试库使用 `postgresql://postgres:postgres@localhost:5433/safety_hazard_test`（5433 端口与本地开发库 5432 隔离）。
- 切换 schema 后必须新建迁移：`cd apps/backend && npx prisma migrate dev -m "<description>"`。
- 生产部署用 `migrate.sh`（`npx prisma migrate deploy`）；baseline 迁移 `0_init` 已在切换时通过 `prisma migrate resolve --applied` 标 baseline。

### 认证与授权
- **JWT in httpOnly cookie**（`SameSite=Strict`，生产 `Secure`），密码 bcrypt cost=12，登录成功后透明 rehash。
- `JwtAuthGuard` 全局守卫，从 cookie 或 `Authorization: Bearer` 提取 token。
- 角色守卫在 controller 上以 `@Roles('admin')` + 局部 `RolesGuard` 实现。
- 启动期 `assert_safe_for_runtime`：staging/production 阻断默认 `admin/admin123` 与弱 `SECRET_KEY`（< 32 字符或占位串），dev 仅打印 WARNING。

### 软删除
- 14 张表里 8 张带 `deleted_at`（`users` / `enterprises` / `batches` / `hazards` / `review_tasks` / `task_hazards` / `notifications` / `photos`），其余 6 张（`audit_logs` / `hazard_status_history` / `import_errors` / `reports` / `statistics_daily` / `statistics_monthly`）没有该列，写入即永久。Service 查询统一过滤 `where: { deleted_at: null }`；软删走 `update({ deleted_at: new Date() })`，由 `prisma/soft-delete.middleware.ts` 仅对只读动作自动注入。

### 后台任务（BullMQ）
- 队列在 `src/queues/bullmq.module.ts` 注册：`report_queue`、`notification_cleanup_queue`、`statistics_queue`。
- Worker 与 API 共享同一份代码，通过 `dist/queues/worker.js` 启动 `NestApplicationContext`。
- Producer 在 service 内通过 `@InjectQueue('report_queue')` 入队；`report.processor.ts` 用 Playwright（Chromium）+ `docx` 生成 PDF / Word。
- 启动器由 `nestjs-schedule` 提供 cron（每日 03:00 清理 30 天前的已读通知）。

### 报告生成
- `QueuesModule` + `ReportProcessor`（BullMQ consumer）。
- `ReportRenderer` 用 Playwright Chromium headless 把 HTML 渲染为 PDF；Word 用 `docx` 库拼装。
- 模板集中在 `reports/reports.service.ts` 内的字符串拼接，避免模板引擎依赖。

### 图片存储
- `StorageModule` 使用 `@aws-sdk/client-s3` 连 MinIO（S3 兼容）。
- 上传：`PUT` 到 `hazard-photos/UUID.jpg`，上传成功后写 `photos` 表。
- 下载：`UrlSignerService` 生成 HMAC-SHA256 签名 URL（`?sig=&exp=`），TTL 默认 900s；旧 `?token=<jwt>` 作为 1 个发布周期的回退（响应头 `X-Photo-Auth-Deprecated: true`）。

### 时区
- 后端统一使用 `Asia/Shanghai`（`dayjs`/`Date` + process.env.TZ=Asia/Shanghai）。
- 数据库 `DateTime` 字段为 `timestamptz`，存 UTC；前端用 dayjs 转 Asia/Shanghai 渲染。

### 通知机制
- 通知写入与业务操作在同一 Prisma 事务中提交。
- 触发场景：任务创建 / 完成 / 取消、隐患复核、报告生成完成。
- 失败不阻断主流程：try/catch + logger.warn 输出。
- 每 30 天自动清理已读通知（`notification_cleanup.processor.ts`）。

### 审计日志
- `audit_logs` 表记录 `{ user_id, action, target_type, target_id, detail, ip_address, method, path, status_code, user_agent, created_at }`。
- 业务操作的成功日志在 service 里手动调用 `AuditLogService.log(...)`。
- 失败场景（登录失败）通过 `AuthService.recordFailure(...)` 或全站 `AllExceptionsFilter` 统一记录。

### 限流
- `@nestjs/throttler` 在 `AppModule` 全局注册 `ThrottlerGuard`：`60/minute` 默认。
- `/auth/login` 单独走 `slowapi`-等价的 Throttler 装饰器 `5/minute`（Redis 共享计数器）。

### 健康检查 / 指标
- `GET /health` → `TerminusHealthCheck`，探测 Prisma 连通。返回 `{ status: 'ok', info: { db: { status: 'up' } } }`。
- `GET /metrics` → Prometheus，输出 `nestjs_*` + Prisma 客户端指标（`@willsoto/nestjs-prometheus`）。

---

## 前端架构细节

### 路由与分组
- App Router，`(dashboard)/` 路由组承载登录后页面，共享 `layout.tsx`（侧边栏 + 顶栏 + 内容区）。
- 登录页 `app/login/page.tsx` 是独立路由，不在 dashboard 组里。

### 认证
- 登录成功后服务端通过 `Set-Cookie` 写入 httpOnly JWT；前端 `lib/api.ts` 的 axios 实例开启 `withCredentials`。
- 401 拦截：非登录请求直接 `window.location.href = '/login'`。已登录页面的 401 也走同一路径（依赖后端做 cookie 失效）。

### 状态管理
- Zustand 单例 store：`userStore`（`me` / `refetch`）、`notificationStore`（`unreadCount` + 30s 轮询 `GET /notifications/unread-count`）。
- 不引入 Redux；跨页面共享状态统一走 store + hook。

### API 错误翻译
- 后端返回英文错误消息，前端 `lib/errors.ts` 维护映射表（`key` 字符串 → 中文提示）。
- 兜底：未匹配到则展示英文原文。

### UI 库使用约定
- AntD 5 组件直接使用，所有交互文本、提示、表单 label 都是中文。
- 图标优先用 `@ant-design/icons`，其次 lucide-react；不内置 SVG 手画。
- 颜色用 AntD `theme.token`，避免一注色独大（详见 `theme.css`）。

### 国际化
- 单一语言（中文）。错误码与服务端约定的英文字符串 → 前端映射中文。

### 测试
- Playwright 在 `e2e/`，默认 baseURL `http://localhost:3000`，webServer 配置同时启动 backend（`dist/src/main.js`）+ `next dev`。
- 跑前：`cd apps/backend && npm run build`，再 `cd apps/frontend && npx playwright test`。

---

## 构建与运行命令

### 本地开发（推荐）
```bash
cd apps/backend
cp .env.example .env   # 视需要修改（默认 SECRET_KEY 仅 dev 接受）
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev      # http://localhost:8000

cd apps/frontend
npm install
npm run dev            # http://localhost:3000
```

### 一键本地全栈（Docker）
```bash
docker compose up --build
```
包含：postgres + redis + minio + backend + worker + frontend。访问：
- 前端 http://localhost:3000
- 后端 API http://localhost:8000/api/v1
- MinIO console http://localhost:9001
- 后端 metrics http://localhost:8000/metrics

### 单测 / E2E
```bash
# 后端 Jest（依赖本地 Postgres 5433 / Redis）
cd apps/backend
npm test                # 全部 *.e2e-spec.ts

# 前端 Playwright（依赖 backend 已起 + npm run build 已跑）
cd apps/frontend
npm run build
npx playwright test
```

### 代码检查与构建
```bash
cd apps/frontend
npm run lint
npm run build
```

---

## 数据库变更规范

**修改 `prisma/schema.prisma` 后必须马上新建迁移。**

```bash
cd apps/backend
npx prisma migrate dev -m "description"     # 本地
# 提交后由 migrate.sh（生产）执行 npx prisma migrate deploy
```

迁移文件提交到仓库，不要在生产环境直接编辑 schema。

---

## 代码风格

### 后端（TypeScript / NestJS）
- `strict: true`，禁止 `any`（必要时用 `unknown` + 收窄）。
- DI 优先于 new；所有 service 通过构造注入。
- 异步统一 Promise 返回，不混用 callback；错误抛 `HttpException` 子类或 NestJS 内置异常。
- 模块边界：跨模块依赖只通过 service，不通过 Prisma 直查另一模块的表。
- DTO 用 `class-validator`，Controller 上 `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))`。

### 前端（TypeScript / React）
- `strict: true`，禁止 `any`。
- 函数组件 + Hooks，页面组件放 `src/app/(dashboard)/<page>/page.tsx`。
- API 调用封装在 `src/lib/*.ts`，组件不直接调 axios。
- ESLint 规则中关闭 `no-explicit-any`（项目层约定：`unknown` 优先，禁止 `any`）。

### 通用
- 错误消息后端英文（由前端 `errors.ts` 翻译中文展示）。
- 注释只解释意图，不复述代码。
- 引入新依赖前先确认是否已有等价包；不要重复造轮子。

---

## 环境变量（`apps/backend/.env`）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:postgres@localhost:5432/safety_hazard` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT 签名密钥 | dev 占位（启动期 `assert_safe_for_runtime` 强校验 staging/production） |
| `MINIO_ENDPOINT` | MinIO 地址 | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 秘密密钥 | `minioadmin` |
| `MINIO_BUCKET` | MinIO 存储桶名 | `hazard-photos` |
| `MINIO_SECURE` | 是否 HTTPS | `false` |
| `ALLOWED_ORIGINS` | CORS 允许来源（逗号分隔） | `http://localhost:3000` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT 有效期（分钟） | `480` |
| `PHOTO_SIGNATURE_TTL` | 图片签名 URL TTL（秒） | `900` |
| `LOGIN_RATE_LIMIT` | 登录限流 | `5/minute` |
| `PORT` | API 端口 | `8000` |
| `ENV` | 运行环境 | `dev` / `test` / `staging` / `production` |

前端仅需 `NEXT_PUBLIC_API_BASE`（默认 `/api/v1`，走同源 nginx 反代）。

---

## 部署

### 一键部署
```bash
python auto-deploy.py
```
SSH 连腾讯云，自动完成：代码拉取、Docker 构建、`migrate.sh`、Nginx reload。

### 手动更新
```bash
cd /opt/safety-hazard-review-system
git pull
sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d --build
sudo ./migrate.sh
```
> 必须带 `--env-file /etc/safety-hazard.env`，否则容器会用默认弱密码，DB 认证失败。

### 端口规划（prod）
| 用途 | 对外 | 容器内 |
|------|------|--------|
| Nginx（前端 + API 反代） | 80 | — |
| Backend (NestJS) | — | 127.0.0.1:8000 |
| Frontend (Next.js) | — | 127.0.0.1:3000 |
| Postgres | — | 127.0.0.1:5432 |
| Redis | — | 127.0.0.1:6379 |
| MinIO | — | 127.0.0.1:9000/9001 |

### 安全组最小开放
| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS（启用 SSL 后） |

---

## 安全注意事项

- **启动期硬阻断**：`apps/backend/src/common/startup-checks.ts` 在 `staging/production` 阻断 `admin/admin123` 仍存在与 `SECRET_KEY` 弱；dev 仅 `console.warn`。
- **JWT cookie**：httpOnly + `SameSite=Strict`（prod 加 `Secure`）。前端不再把 JWT 写 localStorage；老代码残留请改用 `/api/v1/auth/me` + cookie。
- **图片访问**：HMAC-SHA256 签名短链（`?sig=&exp=`），TTL 默认 15 分钟，TTL 内浏览器缓存可复用。`?token=<jwt>` 仅作为 1 个发布周期的兼容回退，响应头 `X-Photo-Auth-Deprecated: true`。
- **登录限流**：Throttler（Redis 共享），`5/minute/IP`，生产建议升级到 `IP+username` 双键。
- **文件上传**：`PhotosController` 限制 10MB，按文件头魔数校验 MIME（JPEG/PNG/WebP/GIF）。
- **管理员密码**：`seed.ts` 写入 `admin/admin123`，生产环境必须 `npm run change-password` 或 UI 上改；不修改则启动期硬阻断。
- **Nginx 头**（`nginx.conf`）：CSP / `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy`；HTTPS 时加 `Strict-Transport-Security`。
- **CORS**：`main.ts` 解析 `ALLOWED_ORIGINS` 逗号分隔生成白名单；启动期不再接受 `*`。
- **依赖**：用 `bcrypt@5`（active 维护）；Excel 用 `exceljs@^4`（已替代有 CVE 的 `xlsx@0.18.5`，仅 BatchHistory 下载失败明细仍用）。
---

## 已知 / 未完成项（不影响当前代码提交）

详见 `docs/PHASE6_STATUS.md`，主要为运营动作：
- staging 演练 2 轮（需要真实 staging 环境）
- 真实生产切换窗口（依赖上述演练）
- 切流后 24h P0/P1 监控盯盘
