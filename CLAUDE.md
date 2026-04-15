# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

安全生产隐患复核系统 —— 一个用于管理企业安全隐患复核任务的全栈应用。

## 技术栈

- **后端：** Python 3.11、FastAPI、SQLAlchemy 2.0（异步）、PostgreSQL、Celery、Redis、MinIO
- **前端：** React 18、TypeScript、Vite、Ant Design 5、React Router 6、Axios
- **基础设施：** Docker Compose 用于本地开发

## 常用命令

### 后端
- `cd backend && pip install -r requirements.txt` — 安装依赖
- `cd backend && uvicorn app.main:app --reload --port 8000` — 启动开发服务器
- `cd backend && pytest` — 运行全部测试
- `cd backend && pytest tests/test_auth.py` — 运行单个测试文件
- `cd backend && python scripts/seed_admin.py` — 初始化管理员账号（`admin` / `admin123`）

### 前端
- `cd frontend && npm run dev` — 启动 Vite 开发服务器（端口 5173，代理 `/api` 到 `localhost:8000`）
- `cd frontend && npm run build` — 生产构建
- `cd frontend && npm run lint` — 运行 ESLint

### Docker Compose
- `docker-compose up --build` — 启动完整服务（Postgres、Redis、MinIO、后端、Celery、前端）

## 架构

### 后端结构
- `app/routers/` — FastAPI 路由处理器（按领域划分）
- `app/models/` — SQLAlchemy ORM 模型，使用 `declarative_base()`
- `app/schemas/` — Pydantic 请求/响应模型
- `app/services/` — 业务逻辑（导入、报告生成、存储）
- `app/tasks/` — Celery 后台任务
- `app/core/` — 配置、数据库引擎、安全工具
- `app/dependencies/` — 认证和权限依赖
- `tests/` — 异步 pytest 测试套件，使用 session 级别的数据库 fixture

### 后端关键模式
- **异步数据库：** 使用 `create_async_engine` 配合 `asyncpg`。`app/core/database.py` 在运行时将 `postgresql+psycopg2://` URL 转换为 `postgresql+asyncpg://`。
- **认证：** OAuth2 密码流程 + JWT。Token 接口为 `/api/v1/auth/login`。仅管理员可访问的路由使用 `require_admin` 依赖。
- **软删除：** 大多数模型都有 `deleted_at` 字段；查询时应过滤 `deleted_at.is_(None)`。
- **报告生成：** Celery 任务（`app/tasks/report_tasks.py`）使用 Playwright 将 HTML 渲染为 PDF，并用 python-docx 生成 Word 文档。
- **图片存储：** 通过 `StorageService` 使用 MinIO。图片在上传前会用 Pillow 生成缩略图。
- **时区：** 后端统一使用 `ZoneInfo("Asia/Shanghai")` 作为系统时区，存储在 `DateTime(timezone=True)` 字段中。

### 前端结构
- `src/pages/` — 页面级组件（如 `Hazard/HazardList.tsx`）
- `src/components/` — 共享 UI 组件（如 `Layout/`）
- `src/api/` — 按领域封装的 Axios 请求（`request.ts` 中处理了认证和 401 拦截）
- `src/store/` — 当前为空；依赖中已包含 Zustand

### 前端关键模式
- **API 代理：** Vite 配置将 `/api` 代理到 `http://localhost:8000`。前端调用使用 `/api/v1/...`。
- **认证状态：** Token 存储在 `localStorage` 中。`request.ts` 拦截 401 响应，清除 token 并重定向到 `/login`。
- **界面语言：** 使用中文标签和提示信息。

## 数据库变更规范

**更新数据库结构后，必须及时进行数据库迁移。**

- 项目使用 Alembic 进行迁移管理（已在 `requirements.txt` 中）。
- 修改 `app/models/` 下的模型后，执行：
  - `cd backend && alembic revision --autogenerate -m "描述"` — 生成迁移脚本
  - `cd backend && alembic upgrade head` — 应用迁移
- 开发环境中如果尚未配置 Alembic，可临时使用 `Base.metadata.drop_all` + `create_all` 重建，但**生产环境严禁这样做**。
- 修改模型后，如果运行的后端进程是旧版本，新路由可能不生效（表现为 405 Method Not Allowed），需要重启 `uvicorn`。

## 测试

- 后端测试需要本地 Postgres 数据库：`postgresql+asyncpg://postgres:postgres@localhost:5432/safety_hazard_test`
- `conftest.py` 在每个 session 开始时创建/删除所有表，并注入管理员账号（`admin` / `admin123`）。
- 测试使用 `httpx.AsyncClient` + `ASGITransport`，并覆盖 `get_db` 以使用测试数据库。

## 环境配置

- 后端通过 `pydantic-settings` 读取 `backend/.env`。
- 默认本地凭据已在 `docker-compose.yml` 和 `backend/.env` 中配置。
