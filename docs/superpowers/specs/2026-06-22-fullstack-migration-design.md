# 安全生产隐患复核系统 — 全栈技术栈迁移设计

**日期**：2026-06-22  
**状态**：待实施  
**作者**：Claude Code (superpowers:brainstorming)  
**范围**：将现有 Python/FastAPI + React/Vite 栈迁移为 TypeScript 全栈（NestJS + Prisma + Next.js App Router），保留 PostgreSQL、Redis、MinIO、Docker Compose + Nginx。

---

## 1. 背景与目标

### 1.1 当前技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2.0（异步） |
| 数据库/迁移 | PostgreSQL 15 + Alembic |
| 缓存/队列 | Redis 7 + Celery 5 |
| 对象存储 | MinIO |
| 报告生成 | Playwright + python-docx |
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 |
| 部署 | Docker Compose + Nginx |

### 1.2 迁移目标

- **团队技术栈统一**：前后端统一使用 TypeScript，降低上下文切换成本。
- **保留基础设施**：PostgreSQL、Redis、MinIO、Docker Compose + Nginx 继续沿用。
- **保持业务连续性**：对外 API 契约尽量不变，切换窗口可控，具备回滚能力。
- **提升可维护性**：使用类型安全、生态成熟的框架（NestJS + Prisma + Next.js）。

---

## 2. 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 后端框架 | NestJS | 模块化、依赖注入、与现有按领域划分路由的风格对应 |
| ORM | Prisma | 类型生成强、迁移方便、与 NestJS/Next.js 生态结合好 |
| 任务队列 | @nestjs/bullmq + Redis | 替代 Celery 最自然，Redis 不变 |
| 前端框架 | Next.js App Router | 统一语言，支持 SSR/Server Components |
| UI 库 | Ant Design 5（保留） | 与现有中文界面一致，降低前端重写成本 |
| API 协议 | REST (`/api/v1/*`) | 保持现有 URL 结构，前端改动最小 |
| 部署方式 | Docker Compose + Nginx | 对外统一入口，内部前后端独立容器 |
| 迁移策略 | 伪一次性切换 | 新分支完整重写，切换窗口短，回滚可控 |

---

## 3. 目标架构

### 3.1 部署拓扑

```
用户
 │
 ▼
Nginx (80/443) ──▶ /api/v1/*  ──▶ backend (NestJS)
              └──▶ /*         ──▶ frontend (Next.js)
 │
 ├─ PostgreSQL
 ├─ Redis
 ├─ MinIO
 └─ worker (BullMQ queue consumer，可与 backend 同镜像不同启动命令)
```

### 3.2 后端模块划分

| NestJS 模块 | 原 FastAPI 路由 | 核心职责 |
|-------------|-----------------|----------|
| `AuthModule` | `/api/v1/auth/*` | 登录、JWT、当前用户、密码 rehash |
| `UsersModule` | `/api/v1/users/*` | 用户 CRUD、重置密码、软删除 |
| `EnterprisesModule` | `/api/v1/enterprises/*` | 企业 CRUD、导入导出、统计 |
| `HazardsModule` | `/api/v1/hazards/*` | 隐患列表、详情、字段级编辑 |
| `BatchesModule` | `/api/v1/batches/*` | 批次、导入预览、错误明细 |
| `ReviewTasksModule` | `/api/v1/review-tasks/*` | 任务创建、复核、完成、报告触发 |
| `PhotosModule` | `/api/v1/photos/*` | 上传、HMAC 签名 URL、绑定、删除 |
| `ReportsModule` | `/api/v1/reports/*` | 报告状态、下载 |
| `StatisticsModule` | `/api/v1/statistics/*` | 多维统计查询 |
| `NotificationsModule` | `/api/v1/notifications/*` | 通知列表、未读数、标记已读 |
| `AuditLogsModule` | `/api/v1/audit-logs/*` | 审计日志记录与查询 |

### 3.3 后端项目结构

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                 # 环境变量校验与加载
│   ├── prisma/                 # schema + 自定义 soft-delete middleware
│   ├── common/                 # guards, interceptors, filters, pipes, decorators
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── enterprises/
│   │   ├── hazards/
│   │   ├── batches/
│   │   ├── review-tasks/
│   │   ├── photos/
│   │   ├── reports/
│   │   ├── statistics/
│   │   ├── notifications/
│   │   └── audit-logs/
│   └── queues/                 # BullMQ processor（如 report.processor.ts）
├── prisma/schema.prisma
├── prisma/migrations/
└── test/
```

---

## 4. 数据库与 ORM

### 4.1 Prisma Schema 生成

1. 对现有 PostgreSQL 运行 `npx prisma db pull`，生成初始 schema。
2. 按项目命名规范微调（camelCase 字段、Prisma 关系）。
3. 人工校验字段类型、关系、索引、约束，确保与 SQLAlchemy/Alembic 完全一致。
4. 使用 `prisma migrate diff` 对比，确认无差异。

### 4.2 软删除

- 所有带 `deletedAt` 的模型通过 Prisma client `$use` middleware 自动追加 `deletedAt: null` 过滤。
- `findUnique` 改写为 `findFirst` 以兼容软删除过滤。

### 4.3 迁移脚本切换

- 停止 Alembic，后续由 `prisma migrate dev/deploy` 接管。
- 切换前需保证现有 Alembic 历史与 Prisma schema 等价。
- 新环境首次部署执行 `prisma migrate deploy`。

### 4.4 数据迁移

- 由于 schema 保持不变，**无需 ETL**，直接复用原数据库。
- 切换窗口：备份数据库 → 停止旧服务 → `prisma migrate deploy` → 启动新服务。

---

## 5. 认证、权限与安全

### 5.1 认证

- **策略**：`passport-local` 校验用户名密码 + `passport-jwt` 校验 token。
- **Token**：JWT（HS256），有效期 8 小时，存储于 `localStorage`。
- **密码**：`bcrypt` 成本因子 12，登录时自动 rehash 旧哈希。

### 5.2 Guard 体系

| Guard | 作用 |
|-------|------|
| `JwtAuthGuard` | 解析并验证 JWT |
| `ActiveUserGuard` | 确认 `isActive === true` 且 `deletedAt` 为空 |
| `AdminGuard` | 确认 `role === 'admin'` |

### 5.3 限流

- 使用 `@nestjs/throttler`。
- 登录接口：`5/分钟/IP`。
- 其他接口：通用限流策略。

### 5.4 生产安全启动检查

- 生产环境若 `SECRET_KEY` 为默认值或长度 < 32，应用拒绝启动。
- 生产环境若存在默认 `admin/admin123` 账号，应用拒绝启动。

---

## 6. 队列与异步任务

### 6.1 队列基础设施

- 使用 `@nestjs/bullmq`，Redis 作为 broker/backend。
- 核心队列：`report-queue`。

### 6.2 报告生成流程

1. 用户点击“生成报告”。
2. `ReviewTasksController` 创建 `Report` 记录（`status=pending`）。
3. 向 `report-queue` 添加 job。
4. 立即返回 `{ reportId, status: pending }`。
5. `ReportProcessor` 在 worker 进程中执行：
   - 新建 Prisma 会话。
   - 使用 Playwright + Chromium 渲染 HTML → PDF。
   - 使用 Node 端 docx 库生成 Word（需选型确认，见 9.3）。
   - 上传至 MinIO。
   - 更新 `Report` 状态为 `completed` 或 `failed`。
6. 前端轮询 `GET /api/v1/reports/:id`。
7. 完成后发送系统通知。

---

## 7. 对象存储与照片访问

### 7.1 存储服务

- 使用 `@aws-sdk/client-s3` 配置 endpoint 指向 MinIO。
- `StorageService` 封装 `putObject`、`getObject`、`deleteObject`。
- 缩略图生成使用 `sharp`。

### 7.2 URL 签名

- 保留现有 HMAC `?sig=&exp=` 机制，由 `UrlSignerService` 实现。
- 确保旧链接及前端逻辑兼容。

---

## 8. 前端设计

### 8.1 项目结构

```
frontend/
├── app/
│   ├── layout.tsx              # 根布局、Ant Design Registry、全局 provider
│   ├── login/page.tsx          # 登录页
│   ├── (dashboard)/            # 受保护后台路由组
│   │   ├── layout.tsx          # 侧边栏 + 头部 + 认证守卫
│   │   ├── page.tsx            # Dashboard 首页
│   │   ├── enterprises/
│   │   ├── hazards/
│   │   ├── batches/
│   │   ├── review-tasks/
│   │   ├── reports/
│   │   ├── statistics/
│   │   ├── notifications/
│   │   ├── audit-logs/
│   │   └── users/
│   └── api/                    # 如需 Next.js API Route 做轻量代理（可选）
├── components/                 # 共享组件
├── lib/
│   ├── api.ts                  # Axios 实例 + 拦截器
│   ├── auth.ts                 # token 读写、登录/登出
│   └── utils.ts
├── stores/
│   ├── userStore.ts            # Zustand
│   └── notificationStore.ts    # Zustand
├── styles/
└── types/                      # 后端生成的 TS 类型
```

### 8.2 页面路由映射

| 原页面 | Next.js 路径 |
|--------|--------------|
| Login | `/login` |
| Dashboard | `/(dashboard)/page.tsx` |
| EnterpriseList/Detail | `/(dashboard)/enterprises` |
| HazardList/Detail | `/(dashboard)/hazards` |
| BatchHistory/Import | `/(dashboard)/batches` |
| TaskList/Detail | `/(dashboard)/review-tasks` |
| Statistics | `/(dashboard)/statistics` |
| NotificationList | `/(dashboard)/notifications` |
| AuditLogList | `/(dashboard)/audit-logs` |
| UserList | `/(dashboard)/users` |

### 8.3 认证与状态

- Token 继续存储于 `localStorage`。
- Axios 请求拦截器自动附加 Bearer token。
- 401 响应清除 token 并重定向到 `/login`。
- `(dashboard)/layout.tsx` 客户端组件检查 token。
- Zustand 保留 `userStore` 和 `notificationStore`。

### 8.4 UI 与组件

- 保留 Ant Design 5，使用 `@ant-design/nextjs-registry` 适配 SSR。
- 需要浏览器 API 或交互的组件加 `"use client"`，其余尽量使用 Server Component。
- 图表使用 `@ant-design/charts`，在客户端组件中渲染。

### 8.5 API 客户端

- 后端启用 `@nestjs/swagger`，导出 OpenAPI JSON。
- 使用 `openapi-typescript` + `openapi-fetch`（或 `axios` + 生成类型）生成 TS 类型与客户端。
- 生产环境前端直接请求 `/api/v1/*`，由 Nginx 转发到 NestJS。

---

## 9. 数据流与错误处理

### 9.1 登录数据流

```
用户提交表单
    ↓
Next.js /login (Client)
    ↓
POST /api/v1/auth/login → Nginx → NestJS AuthController
    ↓
LocalStrategy 校验 bcrypt → JwtService 签发 token
    ↓
返回 { access_token, token_type }
    ↓
前端写入 localStorage + 更新 userStore → 跳转 Dashboard
```

### 9.2 列表查询数据流（Server Component）

```
Next.js /enterprises/page.tsx (Server Component)
    ↓
fetch('/api/v1/enterprises?page=1&size=20', headers: Bearer token)
    ↓
Nginx → NestJS EnterprisesController → JwtAuthGuard → ActiveUserGuard
    ↓
Prisma 查询（自动过滤 deletedAt）→ 分页返回
    ↓
Server Component 渲染 Ant Design Table
```

### 9.3 错误处理

- 全局异常过滤器 `AllExceptionsFilter` 将 NestJS 异常统一转换为：

```json
{
  "detail": "原始英文错误",
  "status_code": 400
}
```

- 与现有 FastAPI HTTPException 结构保持一致。
- 前端保留英→中错误消息映射表。
- 401 跳转登录，403 提示无权限，429 提示操作过于频繁。

### 9.4 审计日志

- 在关键变更点（创建、更新、删除、导入、复核）写入 `audit_logs`。
- 使用 NestJS 拦截器或 `@nestjs/event-emitter` 解耦审计逻辑与业务代码。
- 记录：操作人、动作、资源类型、资源 ID、变更前后 JSONB、IP、时间戳。

### 9.5 日志

- 使用 `pino`/`nestjs-pino`。
- 所有 HTTP 请求输出：method、path、status、duration、userId、requestId。
- Prisma query 日志开发环境开启，生产环境采样或关闭。

---

## 10. 测试策略

### 10.1 后端测试

| 类型 | 范围 | 工具 |
|------|------|------|
| 单元测试 | Services、Utils、HMAC 签名、bcrypt 逻辑 | Jest |
| 集成测试 | Controllers + Guards + Prisma（真实 Postgres 测试库） | `supertest` + `testcontainers`/本地测试库 |
| E2E 测试 | 完整 HTTP 流程 | `supertest` + 内存 Redis + MinIO mock |

- 测试数据库：`safety_hazard_test`，每次测试前 `prisma migrate deploy` + 种子 admin。
- MinIO 模拟：monkey-patch `StorageService` 或本地 MinIO 容器。
- 队列测试：使用测试 Redis，测试后清空。

### 10.2 前端测试

| 类型 | 范围 | 工具 |
|------|------|------|
| 组件单元测试 | 通用组件、表单验证 | Vitest + RTL + jsdom |
| 页面集成测试 | 关键页面渲染、交互 | Vitest + RTL + MSW |
| E2E | 登录→创建任务→复核→生成报告 | Playwright |

---

## 11. 实施阶段

| 阶段 | 目标 | 产出 |
|------|------|------|
| 阶段 1 | 搭建 NestJS + Prisma 骨架 + 认证/用户模块 | 可登录、可跑测试 |
| 阶段 2 | 迁移核心模块（企业、隐患、批次、复核任务） | 主业务流程可跑通 |
| 阶段 3 | 迁移照片、报告、队列、通知、审计日志 | 异步任务可跑通 |
| 阶段 4 | 前端 Next.js 重写 + API 对接 | UI 功能对齐 |
| 阶段 5 | 统计、导入导出、部署脚本、E2E | 完整可用 |
| 阶段 6 | 数据迁移演练 + 生产切换 + 监控 | 上线 |

---

## 12. 上线检查清单

- [ ] 生产 `SECRET_KEY` 已更换为强随机串。
- [ ] 默认 `admin/admin123` 已禁用或修改。
- [ ] Nginx 安全头（CSP/HSTS/X-Frame-Options）已配置。
- [ ] 数据库已备份。
- [ ] 旧服务镜像与配置已保留。
- [ ] 健康检查、日志、告警已接入。

---

## 13. 待确认事项

1. **Word 报告生成库**：Python 端使用 `python-docx`，Node 端需选型（如 `docx-templates`、`docx` 等），若 Node 端无合适库可考虑保留一个轻量的 Python 微服务专门生成 Word。
2. **前端数据获取库**：迁移初期可继续使用 Axios + `useEffect`；稳定后建议引入 SWR 或 React Query。
3. **统计表生成机制**：需确认现有 `StatisticsDaily/Monthly` 的写入来源（Celery Beat 定时任务还是外部脚本），并在新队列中实现对应定时任务。

---

## 14. 附录：保留与替换对照表

| 能力 | 原实现 | 新实现 |
|------|--------|--------|
| HTTP 框架 | FastAPI | NestJS |
| ORM | SQLAlchemy 2.0 | Prisma |
| 迁移工具 | Alembic | Prisma Migrate |
| 任务队列 | Celery | @nestjs/bullmq |
| 前端构建 | Vite | Next.js |
| 前端路由 | React Router 6 | Next.js App Router |
| 状态管理 | Zustand | Zustand（保留） |
| 限流 | slowapi | @nestjs/throttler |
| 密码哈希 | bcrypt | bcrypt |
| JWT | PyJWT | @nestjs/jwt |
| 对象存储 SDK | minio (Python) | @aws-sdk/client-s3 |
| 缩略图 | Pillow | sharp |
| 测试框架 | pytest-asyncio | Jest |
| 端到端测试 | 无/较少 | Playwright |
