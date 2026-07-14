# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

安全生产隐患复核系统 —— 一个用于管理企业安全隐患复核任务的全栈应用。

## 技术栈

- **后端：** Node.js 20、NestJS 10、TypeScript、Prisma 5、PostgreSQL 16、BullMQ/Redis、MinIO、Playwright
- **前端：** Next.js 14 (App Router)、React 18、TypeScript、Ant Design 5、Axios
- **基础设施：** Docker Compose 用于本地开发

## 常用命令

### 后端

工作目录：`apps/backend`

- `npm install` — 安装依赖
- `npx prisma generate` — 生成 Prisma Client
- `npx prisma migrate dev` — 创建并应用迁移
- `npx prisma db push` — 快速同步 schema（仅开发）
- `npm run start:dev` — 启动开发服务器（端口 8000）
- `npm run test:e2e` — 运行 E2E 测试（需要本地 Postgres/Redis/MinIO）
- `npm run build` — 生产构建
- `npm run lint` — 运行 ESLint

### 前端

工作目录：`apps/frontend`

- `npm install` — 安装依赖
- `npm run dev` — 启动 Next.js 开发服务器（端口 3000）
- `npm run build` — 生产构建
- `npm run lint` — 运行 ESLint
- `npx playwright test` — 运行 E2E 测试

### Docker Compose

- `docker compose up --build` — 启动完整服务（Postgres、Redis、MinIO、后端、Worker、前端）

## 架构

### 后端结构

- `apps/backend/src/modules/` — NestJS 模块（按领域划分，如 auth、users、hazards、review-tasks）
- `apps/backend/src/prisma/` — PrismaService、schema、迁移
- `apps/backend/src/common/` — 全局守卫、拦截器、过滤器、装饰器
- `apps/backend/src/storage/` — MinIO StorageService、URL 签名服务
- `apps/backend/src/queues/` — BullMQ 队列定义与报告处理器
- `apps/backend/src/config/` — 环境变量 schema 与配置模块
- `apps/backend/test/` — Jest E2E 测试套件

### 后端关键模式

- **数据库：** Prisma ORM 配合 PostgreSQL。开发连接串见 `apps/backend/.env`。
- **认证：** JWT 通过 HttpOnly `SameSite=Strict` cookie 下发。`JwtAuthGuard` 从 cookie 读取 token，公开路由可回退到 `?token=` query param。
- **权限：** `ActiveUserGuard` 检查用户是否启用；`AdminGuard` 限制仅管理员访问。
- **软删除：** 大多数模型都有 `deleted_at` 字段；查询时应过滤 `deleted_at.is_(null)`。
- **报告生成：** `ReportProcessor` 使用 Playwright 渲染 PDF，使用 docx 生成 Word 文档，结果存入 MinIO。
- **图片存储：** `StorageService` 通过 AWS SDK for S3 访问 MinIO；上传时 sharp 生成缩略图。
- **时区：** 后端统一使用 `Asia/Shanghai` 时间处理业务逻辑；数据库字段使用 `DateTime(timezone=true)`。
- **Cron：** `@nestjs/schedule` 仅在 `ENABLE_CRON=true` 时启用；worker 容器应设置为 `false` 避免双容器重复执行。

### 前端结构

- `apps/frontend/src/app/(dashboard)/` — 登录后页面（Dashboard、隐患、任务、批次、统计等）
- `apps/frontend/src/app/login/` — 登录页
- `apps/frontend/src/components/` — 共享 UI 组件（如 `Layout/`）
- `apps/frontend/src/lib/` — Axios 封装、用户状态、工具函数
- `apps/frontend/src/middleware.ts` — 服务端路由保护，验证 JWT cookie 与 admin 角色

### 前端关键模式

- **API 调用：** `src/lib/api.ts` 中 axios 实例配置 `withCredentials: true`，自动携带 cookie；401 时清除用户并重定向。
- **路由保护：** `middleware.ts` 在服务端拦截未登录/非管理员请求；客户端 `Layout` 仅控制菜单渲染。
- **错误处理：** 使用 `getErrorMessage(err)` 从 `err.response?.data?.detail` 读取后端错误信息。
- **请求取消：** 页面 `useEffect` 创建 `AbortController`，卸载时调用 `abort()` 避免竞态。
- **界面语言：** 使用中文标签和提示信息。

## 数据库变更规范

**更新数据库结构后，必须及时进行数据库迁移。**

- 项目使用 Prisma Migrate 管理迁移。
- 修改 `apps/backend/prisma/schema.prisma` 后，执行：
  - `npx prisma migrate dev --name 描述` — 生成并应用迁移
  - `npx prisma migrate deploy` — 在 CI/生产应用待处理迁移
- 开发环境可临时使用 `npx prisma db push`，但**生产环境严禁这样做**。
- 修改模型后，如果运行的后端进程是旧版本，需要重启服务。

## 测试

- 后端 E2E 测试需要本地 Postgres 数据库：`postgresql://postgres:postgres@localhost:5432/safety_hazard_test`
- `test/jest-e2e.json` 配置串行执行（`maxWorkers: 1`）以避免并行测试数据冲突。
- 测试使用 `supertest` + NestJS `TestingModule`；每个测试文件在 `beforeAll` 中创建 admin 测试账号。
- 前端 E2E 使用 Playwright；共享认证 fixture 位于 `e2e/fixtures/auth.ts`。

## 环境配置

- 后端通过 `env.schema.ts` + `@nestjs/config` 读取 `apps/backend/.env`。
- 关键环境变量：`DATABASE_URL`、`REDIS_URL`、`MINIO_ENDPOINT`、`MINIO_SECURE`、`SECRET_KEY`、`PHOTO_SIGNATURE_SECRET`、`ENABLE_CRON`。
- 默认本地凭据已在 `docker-compose.yml` 和 `apps/backend/.env` 中配置。
