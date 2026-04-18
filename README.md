# 安全生产隐患复核系统

企业安全生产隐患排查、任务分配与复核闭环管理平台。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12、FastAPI、SQLAlchemy 2.0（异步）、Alembic |
| 数据库 | PostgreSQL 15、Redis 7 |
| 对象存储 | MinIO |
| 任务队列 | Celery（Worker + Beat） |
| 前端 | React 18、TypeScript、Vite 5、Ant Design 5 |
| 基础设施 | Docker Compose、Nginx |

## 功能模块

- **企业管理** — 多企业、多区域支持
- **隐患管理** — 批量导入、分级分类、图片上传
- **复核任务** — 任务分配、状态流转、闭环跟踪
- **报告生成** — 异步生成 PDF / Word 报告（Playwright + python-docx）
- **统计分析** — 日/月维度数据汇总
- **用户权限** — JWT 认证、管理员/普通用户角色
- **操作审计** — 全链路操作日志

## 快速开始（本地开发）

### 前提条件

- Docker & Docker Compose
- Python 3.12+（仅后端独立运行时需要）
- Node.js 20+（仅前端独立运行时需要）

### 启动全部服务

```bash
docker compose up --build
```

服务启动后访问：
- 前端：http://localhost:5173
- API 文档：http://localhost:8000/docs

### 初始化管理员账号

```bash
cd backend && python scripts/seed_admin.py
```

默认账号：`admin` / `admin123`（首次登录后请立即修改密码）

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

## 常用命令

```bash
# 运行测试
cd backend && pytest

# 生成数据库迁移
cd backend && alembic revision --autogenerate -m "描述"

# 应用迁移
cd backend && alembic upgrade head

# 前端构建
cd frontend && npm run build

# 前端代码检查
cd frontend && npm run lint
```

## 生产部署（腾讯云 / 云服务器）

### 一键部署

在本地执行：

```bash
python auto-deploy.py
```

脚本会通过 SSH 连接服务器，自动完成：代码拉取、Docker 构建、数据库初始化、Nginx 配置。

### 服务器端口规划

| 用途 | 对外端口 | 容器内部端口 |
|------|----------|-------------|
| 前端（Nginx 代理） | 80 | 127.0.0.1:8080 |
| 后端 API（Nginx 代理） | — | 127.0.0.1:8000 |
| Postgres | 不对外 | 127.0.0.1:5432 |
| Redis | 不对外 | 127.0.0.1:6379 |
| MinIO | 不对外 | 127.0.0.1:9000/9001 |

### 腾讯云安全组最小开放规则

| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH 管理 |
| 80 | TCP | HTTP 访问 |
| 443 | TCP | HTTPS（配置 SSL 后） |

> 其余端口（8000、5432、6379 等）绑定到 127.0.0.1，不对外暴露。

### 多项目部署

同一台服务器部署第二个项目，使用 `project2-template/` 目录下的模板：

1. 修改 `project2-template/deploy-remote.sh` 顶部的项目配置变量
2. 在腾讯云安全组开放端口 81
3. 执行 `python auto-deploy-project2.py`

第二个项目使用端口 81，容器端口 8100（后端）、8180（前端），与项目1完全隔离。

## 项目结构

```
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── routers/          # API 路由
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic 请求/响应模型
│   │   ├── services/         # 业务逻辑
│   │   ├── tasks/            # Celery 任务
│   │   ├── core/             # 配置、数据库、安全
│   │   └── dependencies/     # 认证与权限依赖
│   ├── alembic/              # 数据库迁移
│   ├── scripts/              # 初始化脚本
│   └── tests/                # 测试套件
├── frontend/                 # React 前端
│   └── src/
│       ├── pages/            # 页面组件
│       ├── components/       # 共享组件
│       ├── api/              # Axios 请求封装
│       └── store/            # 状态管理
├── project2-template/        # 第二项目部署模板
├── auto-deploy.py            # 项目1 一键部署脚本
├── auto-deploy-project2.py   # 项目2 一键部署脚本
├── deploy-remote.sh          # 服务器端部署脚本
├── docker-compose.yml        # 本地开发
├── docker-compose.prod.yml   # 生产部署
└── nginx.conf                # Nginx 配置参考
```

## 环境变量

后端通过 `backend/.env` 读取配置（本地开发），生产环境由部署脚本自动生成至 `/etc/safety-hazard.env`。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | — |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT 签名密钥 | — |
| `MINIO_ENDPOINT` | MinIO 地址 | `localhost:9000` |
| `ALLOWED_ORIGINS` | CORS 允许来源 | `http://localhost` |
| `AUTO_CREATE_TABLES` | 启动时自动建表 | `false` |
