# AGENTS.md

本文件面向 AI 编程助手，提供项目的完整上下文、架构说明与开发规范。

---

## 项目概述

**安全生产隐患复核系统** —— 一个管理企业安全隐患排查、任务分配与复核闭环的全栈 Web 应用。

核心功能模块：
- **企业管理** — 多企业、多区域支持
- **隐患管理** — 批量导入（Excel）、分级分类、图片上传
- **复核任务** — 任务分配、状态流转、闭环跟踪
- **报告生成** — 异步生成 PDF / Word 报告（Playwright + python-docx）
- **统计分析** — 日/月维度数据汇总与图表展示
- **用户权限** — JWT 认证、管理员/普通用户角色分离
- **操作审计** — 全链路操作日志记录
- **系统通知** — 任务/复核/报告状态变更实时通知（铃铛下拉 + 通知中心）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12、FastAPI 0.121、SQLAlchemy 2.0（异步）、Alembic 1.13 |
| 数据库 | PostgreSQL 15、Redis 7 |
| 对象存储 | MinIO |
| 任务队列 | Celery 5.3（Worker + Beat） |
| 前端 | React 18、TypeScript 5.9、Vite 5、Ant Design 5、React Router 6 |
| 基础设施 | Docker Compose、Nginx |

---

## 项目结构

```
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── main.py           # FastAPI 应用入口，注册路由与中间件
│   │   ├── routers/          # API 路由（按领域划分：auth, users, enterprises, batches, hazards, review_tasks, photos, reports, statistics, audit_logs, notifications）
│   │   ├── models/           # SQLAlchemy ORM 模型（declarative_base）
│   │   ├── schemas/          # Pydantic 请求/响应模型
│   │   ├── services/         # 业务逻辑（导入、报告生成、存储、审计日志、通知）
│   │   ├── tasks/            # Celery 后台任务（报告生成、照片清理、通知清理）
│   │   ├── core/             # 配置（config.py）、数据库引擎（database.py）、安全工具（security.py）、异常处理（exception_handlers.py）
│   │   └── dependencies/     # 认证（auth.py）与权限（permissions.py）依赖
│   ├── alembic/              # 数据库迁移脚本与配置
│   ├── scripts/              # 初始化脚本（seed_admin.py, enable_pgcrypto.py）
│   ├── tests/                # pytest 异步测试套件
│   ├── requirements.txt      # Python 依赖
│   ├── pytest.ini            # pytest 配置（asyncio_mode = auto）
│   ├── .env                  # 本地开发环境变量
│   ├── Dockerfile            # 后端服务容器镜像（含 Playwright Chromium）
│   └── Dockerfile.celery     # Celery Worker / Beat 容器镜像
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── App.tsx           # 路由配置与认证守卫
│   │   ├── pages/            # 页面级组件（Dashboard, Hazard, Task, Batch, Statistics, User, AuditLog, Notification, Enterprise）
│   │   ├── components/       # 共享 UI 组件（Layout/）
│   │   ├── api/              # Axios 请求封装（按领域分文件：request.ts 统一处理认证、错误翻译、401 拦截）
│   │   ├── store/            # Zustand 状态管理（userStore.ts, notificationStore.ts）
│   │   └── styles/           # 全局样式（theme.css）
│   ├── package.json          # Node 依赖与脚本
│   ├── vite.config.ts        # Vite 配置（开发代理 /api → localhost:8000，生产代码分割）
│   ├── tsconfig.json         # TypeScript 配置（严格模式，路径别名 @/* → src/*）
│   ├── .eslintrc.cjs         # ESLint 配置
│   ├── Dockerfile            # 前端构建 + Nginx 多阶段镜像
│   └── nginx.conf            # 容器内 Nginx 配置
├── docker-compose.yml        # 本地开发编排（所有端口对外暴露）
├── docker-compose.prod.yml   # 生产环境编排（仅 80 对外，其余绑定 127.0.0.1）
├── nginx.conf                # 生产 Nginx 反向代理配置参考
├── auto-deploy.py            # 本地一键部署脚本（SSH → 腾讯云服务器）
├── deploy-remote.sh          # 服务器端部署脚本（Docker + Nginx + 数据库初始化）
├── DEPLOY.md                 # 生产部署详细文档
└── README.md                 # 项目介绍与快速开始
```

---

## 后端架构细节

### 异步数据库
- 使用 `create_async_engine` + `asyncpg`。
- `app/core/database.py` 在运行时将 `postgresql+psycopg2://` URL 动态替换为 `postgresql+asyncpg://`。
- 数据库会话通过 `get_db()` 依赖注入，使用 `async_sessionmaker(expire_on_commit=False, autoflush=False)`。

### 认证与授权
- **OAuth2 密码流程 + JWT**：Token 接口为 `POST /api/v1/auth/login`。
- Token 有效期 8 小时（`ACCESS_TOKEN_EXPIRE_MINUTES = 480`）。
- `get_current_user` 依赖从 Header `Authorization: Bearer <token>` 或 Query 参数 `?token=` 中提取 token。
- 仅管理员可访问的路由使用 `require_admin` 依赖（`app/dependencies/permissions.py`）。

### 软删除
- 大多数模型都有 `deleted_at` 字段；查询时必须过滤 `deleted_at.is_(None)`。
- 被软删除的记录不会出现在常规列表查询中。

### 报告生成
- Celery 任务（`app/tasks/report_tasks.py`）使用 Playwright 将 HTML 渲染为 PDF，并用 `python-docx` 生成 Word 文档。
- 报告模板通过 `app/services/template_service.py` 管理。

### 图片存储
- `StorageService`（`app/services/storage_service.py`）使用 MinIO 作为对象存储。
- 图片上传前用 Pillow 生成缩略图。
- 上传限制：文件大小 10MB，仅允许图片格式（JPEG/PNG/GIF/WebP）。

### 时区
- 后端统一使用 `ZoneInfo("Asia/Shanghai")` 作为系统时区。
- 数据库存储在 `DateTime(timezone=True)` 字段中。

### 通知机制
- 通知与业务操作在同一数据库事务中提交，失败不阻断主流程。
- Celery Beat 每日凌晨 3 点自动清理 30 天前的已读通知（软删除）。
- 触发场景：任务创建、任务完成、任务取消、隐患复核、报告生成。

### 审计日志
- `AuditableHTTPException` 自定义异常用于需要记录审计日志的失败场景（如登录失败）。
- 通过 `audit_exception_handler` 统一处理并记录失败日志。
- 正常业务操作的成功日志通过 `audit_log_service` 在路由或服务层主动记录。

---

## 前端架构细节

### API 代理
- Vite 开发服务器将 `/api` 代理到 `http://localhost:8000`。
- 前端调用使用 `/api/v1/...` 前缀。
- 生产环境中由 Nginx 将 `/api/` 反向代理到后端服务。

### 认证状态
- Token 存储在 `localStorage` 的 `token` 键中。
- `request.ts` 拦截 401 响应：非登录请求会清除 token 并重定向到 `/login`。
- `App.tsx` 通过 `storage` 事件监听实现多标签页登录状态同步。

### 路由与懒加载
- 所有页面组件使用 `React.lazy()` 懒加载，减少首屏包体积。
- 路由守卫：未认证用户访问 `/` 会被重定向到 `/login`，已认证用户访问 `/login` 正常显示。

### 状态管理
- 使用 Zustand（而非 Redux）。
- `userStore.ts`：管理当前登录用户信息。
- `notificationStore.ts`：管理通知铃铛的未读数与轮询状态。

### 界面语言
- 所有用户可见的标签、提示信息、错误消息均使用中文。
- `request.ts` 中维护了一张英文错误消息 → 中文的映射表，用于翻译后端返回的英文错误。

---

## 构建与运行命令

### 一键启动全部服务（本地开发）
```bash
docker compose up --build
```
启动后访问：
- 前端：http://localhost:5173
- API 文档：http://localhost:8000/docs

### 单独启动后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 单独启动前端
```bash
cd frontend
npm install
npm run dev   # 端口 5173，自动代理 /api 到 localhost:8000
```

### 初始化管理员账号
```bash
cd backend && python scripts/seed_admin.py
```
默认账号：`admin` / `admin123`（首次登录后请立即修改密码）

### 前端构建
```bash
cd frontend && npm run build
```

### 前端代码检查
```bash
cd frontend && npm run lint
```

---

## 测试

### 运行测试
```bash
cd backend && pytest
```

运行单个测试文件：
```bash
cd backend && pytest tests/test_auth.py
```

### 测试架构
- 使用 `pytest-asyncio`（`asyncio_mode = auto`），测试函数无需显式标记 `async` 为协程（pytest.ini 已配置）。
- 测试使用 `httpx.AsyncClient` + `ASGITransport` 直接调用 FastAPI 应用。
- `conftest.py` 提供以下 fixtures：
  - `event_loop`（session 级别）
  - `setup_database`（session 级别）：在测试 session 开始时创建/删除所有表，并启用 `pgcrypto` 扩展。
  - `seed_admin_user`（session 级别）：注入管理员账号 `admin` / `admin123`。
  - `db_session`（function 级别）：提供独立的数据库会话。
  - `client`（function 级别）：覆盖 `get_db` 依赖以使用测试数据库，测试结束后清理 overrides。

### 测试数据库要求
- 需要本地 PostgreSQL 数据库：`postgresql+asyncpg://postgres:postgres@localhost:5432/safety_hazard_test`
- 测试使用 `NullPool` 避免连接池缓存问题。

---

## 数据库变更规范

**更新数据库结构后，必须及时进行数据库迁移。**

- 项目使用 Alembic 进行迁移管理。
- 修改 `app/models/` 下的模型后，执行：
  ```bash
  cd backend && alembic revision --autogenerate -m "描述"
  cd backend && alembic upgrade head
  ```
- 开发环境中如果尚未配置 Alembic，可临时设置 `AUTO_CREATE_TABLES=true` 让 SQLAlchemy 自动建表，但**生产环境严禁这样做**。
- 修改模型后，如果运行的后端进程是旧版本，新路由可能不生效（表现为 405 Method Not Allowed），需要重启 `uvicorn`。
- Alembic 环境文件 `alembic/env.py` 在 `run_async_migrations` 中使用 `asyncpg` 执行异步迁移；离线模式使用同步 URL。

---

## 代码风格指南

### Python 后端
- 使用 Python 3.12+ 语法特性。
- 异步优先：数据库操作、HTTP 请求均使用 `async/await`。
- 类型注解：函数参数和返回值应标注类型。
- 导入顺序：标准库 → 第三方库 → 项目内部模块。
- 模型查询时注意过滤 `deleted_at.is_(None)` 以遵守软删除约定。
- 错误消息使用英文（由前端 `request.ts` 翻译为中文展示给用户）。
- 需要记录审计日志的失败场景抛出 `AuditableHTTPException` 而非普通 `HTTPException`。

### TypeScript 前端
- TypeScript 严格模式开启（`strict: true`）。
- 未使用的局部变量和参数会报错（`noUnusedLocals`, `noUnusedParameters`）。
- 使用路径别名 `@/*` 引用 `src/*` 下的模块。
- React 组件使用函数组件 + Hooks。
- 页面组件放在 `src/pages/` 下，按功能模块分子目录。
- API 调用按领域分文件（`src/api/hazard.ts`, `src/api/task.ts` 等），统一通过 `request.ts` 实例发起请求。
- ESLint 规则中关闭了 `@typescript-eslint/no-explicit-any`、`react-hooks/exhaustive-deps` 和 `no-empty`，允许适度灵活。

---

## 环境变量

后端通过 `pydantic-settings` 读取 `backend/.env`（本地开发），生产环境由部署脚本自动生成至 `/etc/safety-hazard.env`。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串（使用 psycopg2 格式，运行时自动转 asyncpg） | `postgresql+psycopg2://postgres:postgres@localhost:5432/safety_hazard` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT 签名密钥 | 随机生成（建议生产环境显式设置） |
| `MINIO_ENDPOINT` | MinIO 地址 | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 秘密密钥 | `minioadmin` |
| `MINIO_BUCKET` | MinIO 存储桶名 | `hazard-photos` |
| `ALLOWED_ORIGINS` | CORS 允许来源（逗号分隔） | `http://localhost:5173` |
| `AUTO_CREATE_TABLES` | 启动时自动建表（仅开发） | `false` |

---

## 部署

### 本地开发
使用 `docker-compose.yml`，所有服务端口直接暴露到宿主机。

### 生产环境（腾讯云 / 云服务器）

#### 一键部署
```bash
python auto-deploy.py
```
脚本通过 SSH 连接服务器，自动完成：代码拉取、Docker 构建、数据库初始化、Nginx 配置。

#### 手动更新（已部署后）
```bash
cd /opt/safety-hazard-review-system
git pull
sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d --build
```
> ⚠️ 必须带 `--env-file` 加载保存的密码，否则容器会使用默认密码，导致数据库认证失败。

#### 端口规划
| 用途 | 对外端口 | 容器内部端口 |
|------|----------|-------------|
| 前端（Nginx 代理） | 80 | 127.0.0.1:8080 |
| 后端 API（Nginx 代理） | — | 127.0.0.1:8000 |
| Postgres | 不对外 | 127.0.0.1:5432 |
| Redis | 不对外 | 127.0.0.1:6379 |
| MinIO | 不对外 | 127.0.0.1:9000/9001 |

#### 安全组最小开放规则
| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH 管理 |
| 80 | TCP | HTTP 访问 |
| 443 | TCP | HTTPS（配置 SSL 后） |

---

## 安全注意事项

- **SECRET_KEY**：生产环境必须通过环境变量设置强随机密钥（`openssl rand -hex 32`），不要依赖默认生成的随机值。
- **数据库密码**：生产环境使用强密码，并通过 `--env-file` 持久化到 `/etc/safety-hazard.env`。
- **MinIO**：生产环境绑定到 `127.0.0.1`，不对外暴露 9000/9001 端口。
- **CORS**：`ALLOWED_ORIGINS` 在生产环境应严格限制为实际域名，不要使用 `*`。
- **文件上传**：后端限制文件大小 10MB，并通过文件头校验图片格式，防止恶意文件上传。
- **管理员密码**：首次部署后默认账号为 `admin` / `admin123`，必须在首次登录后立即修改。
- **Nginx**：生产配置设置 `client_max_body_size 50M` 以支持批量图片上传。
