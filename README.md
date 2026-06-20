# 安全生产隐患复核系统 (Safety Hazard Review System)

> 应急管理局"安全生产隐患复核系统" v0.1 — 监管员登记 / 批量导入 → 现场复核 → 科长审核签字 → 销案的全流程闭环。  
> 内置 PWA 离线缓存、MinIO 照片存储、NextAuth 鉴权、移动端友好的政务风格 UI。

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)](https://www.prisma.io)
[![License: Private](https://img.shields.io/badge/license-private-lightgrey)](#)

## ✨ 核心功能

- **案件登记** — 单条登记 + Excel 批量导入（含下载模板 / 预览 / 失败回显）
- **现场复核** — 监管员领取 / 接管 / 逐项核对 / 拍照 / 提交结论
- **科长审核** — 锁定案件 → 签字通过 / 驳回（驳回后回到复核阶段）
- **销案归档** — 状态机驱动（`PENDING_REVIEW → PENDING_AUDIT → IN_AUDIT → CLOSED`），并发安全
- **离线复核** — PWA + IndexedDB 缓存草稿与照片，联网后增量同步（含失败重试与失败上报）
- **统计看板** — KPI / 趋势 / 分布，监管员 / 科长 / 局长分级视图
- **管理后台** — 用户、企业、隐患类型、检查清单模板、审计日志
- **通知中心** — 临期（3 天）提醒、复核提交后向所有科长广播、驳回通知
- **资源回收** — 进程内 cron 每日 02:00 释放失活锁，08:00 扫描临期

## 🧱 技术栈

| 层       | 选型                                                        |
| -------- | ----------------------------------------------------------- |
| 框架     | Next.js 15 (App Router) + React 18 + TypeScript 5.6         |
| 数据     | Prisma 6 + PostgreSQL 16                                    |
| 鉴权     | NextAuth v5 (Credentials) + 角色权限矩阵                    |
| 对象存储 | MinIO（兼容 S3 协议）                                       |
| UI       | Tailwind 3 + Radix UI + shadcn/ui + Lucide + Recharts       |
| PWA      | `@ducanh2912/next-pwa` + IndexedDB (`idb`) + Service Worker |
| 定时任务 | `node-cron`（进程内，与 Next 同进程）                       |
| 表单     | `react-hook-form` + Zod                                     |
| 测试     | Vitest（unit / integration）+ Playwright（e2e）             |
| 日志     | `pino`                                                      |
| 容器化   | Docker / docker-compose（PG + MinIO + app）                 |
| CI       | GitHub Actions（lint + typecheck + test + e2e + build）     |

## 👥 角色

| 角色               | 主要能力                                                       |
| ------------------ | -------------------------------------------------------------- |
| `INSPECTOR` 监管员 | 登记 / 导入 / 列表 / 复核（领取 / 接管 / 提交） / 查统计       |
| `CHIEF` 科长       | 列表 / 审核（领取审核 / 通过 + 签字 / 驳回） / 审计日志 / 统计 |
| `DIRECTOR` 局长    | 全部 `CHIEF` 权限 + 跨科查询                                   |
| `ADMIN` 系统管理员 | 全部业务只读 + 用户 / 企业 / 隐患类型 / 模板 / 审计日志管理    |

完整权限矩阵见 [`src/lib/permissions.ts`](src/lib/permissions.ts)。

## 🚀 快速启动

### 方式 1 — Docker Compose（推荐）

一行命令起 PG + MinIO + app：

```bash
cp .env.example .env
docker compose --profile all up -d
# 等待 ~30s 让 app 跑完 prisma migrate deploy + 启动 next start
open http://localhost:3000
```

只起基础设施、本机 `npm run dev` 调试：

```bash
docker compose --profile infra up -d
npm install
npx prisma migrate dev
npx prisma db seed   # 10 用户 / 15 企业 / 4 隐患类型 / 50 案件
npm run dev
```

### 方式 2 — 本机纯 Node（需自己起 PG / MinIO）

```bash
npm install
# 1. 准备 PG（5432）+ MinIO（9000 / 9001），创建 bucket shr-photos
# 2. 复制 .env 并改 DATABASE_URL / MINIO_* 指向你的服务
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

打开 <http://localhost:3000>，用种子账号登录（密码统一 `password123`）：

| 邮箱                    | 角色   |
| ----------------------- | ------ |
| `inspector@example.com` | 监管员 |
| `chief@example.com`     | 科长   |
| `director@example.com`  | 局长   |
| `admin@example.com`     | 管理员 |

另含 `inspector2@example.com` ... `inspector5@example.com`、`chief2@example.com`、`chief3@example.com`（密码同上），便于演示并发与多角色协作。

## 🌱 种子数据

`npx prisma db seed` 一次性产出：

- **10 用户** — 5 INSPECTOR + 3 CHIEF + 1 DIRECTOR + 1 ADMIN
- **15 企业** — 化工 / 机械 / 纺织 / 建材 / 食品 / 物流 / 电子 / 矿业 / 制药 / 电气 / 塑料 / 汽修 / 印刷 / 粮油 / 建筑
- **4 隐患类型** — 消防 / 特种设备 / 危化品 / 电气
- **4 清单模板** — 每个隐患类型一套（FIRE 5 项，其余 4 项）
- **50 案件** — 工单号按 `YYYYMMDD-NNNN` 编号，按状态分布：15 待复核 / 12 待审核 / 10 审核中 / 13 已销案
  - 严重程度按 30% 重大 / 40% 较大 / 30% 一般加权抽样
  - 4 类隐患平摊，期限按状态分层（待复核含 15% 临期 + 8% 已逾期）
- **50 复核记录** — 待复核案件为 `IN_PROGRESS`，其余为 `SUBMITTED` 含结论、说明、得分（60–100）
- **157 项结果** — 每条复核 3–5 项，85% PASS / 10% FAIL / 5% NA
- **13 签字记录** — 仅 `CLOSED` 案件附 `AuditSignature(PASS)`，`signatureUrl` 为 `seed/signatures/<code>.png` 演示占位（无真实 PNG）
- **19 通知** — 10 临期 + 5 逾期 + 4 科长群发待审核（3 案件 × 3 科长 + 1 仅剩 1 科长）
- **50 审计日志** — 每案件 1 条 `case:register`

**幂等性**：按 `code startsWith ${TODAY_PREFIX}` 守卫，当天已生成过 50 案件则整体跳过，输出当前实体计数。监管员 / 科长并发的 `claimedById` / `lockedById` 与状态对齐。

## 📜 脚本

| 命令                                            | 说明                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                                   | Next dev (port 3000)                                           |
| `npm run build` / `npm start`                   | 生产构建 / 启动                                                |
| `npm run lint`                                  | ESLint (`next/core-web-vitals` + `next/typescript` + prettier) |
| `npm test`                                      | Vitest 一次性                                                  |
| `npm run test:watch` / `npm run test:cov`       | 监听 / 覆盖率                                                  |
| `npm run test:e2e`                              | Playwright E2E（需 dev server + seeded DB）                    |
| `npx prisma migrate dev` / `npx prisma db seed` | 迁移 / 种子                                                    |
| `docker compose --profile infra up -d`          | 仅起 PG + MinIO                                                |
| `docker compose --profile all up -d`            | 起 PG + MinIO + app 全栈                                       |

## 🗂 项目结构

```
src/
├─ app/                  # App Router（admin/ cases/ me/ api/ login/ stats/）
├─ services/             # 业务核心（pure functions，单元测试覆盖）
├─ lib/                  # auth / db / storage / permissions / validation / log
├─ workers/              # node-cron 任务（scanDeadlines / scanRecycle）
├─ pwa/                  # 离线层（IndexedDB + sync worker + manifest）
└─ components/           # ui/ 基础件 + admin/ case/ workbench/ layout/ stats/
prisma/                  # schema + 迁移 + seed
tests/
├─ unit/
│  ├─ services/          # 业务核心（10 个文件）
│  ├─ lib/               # auth / db / storage / permissions / validation / log（3 个）
│  └─ workers/           # node-cron 任务（scanDeadlines / scanRecycle，2 个）
└─ e2e/                  # Playwright
docs/                    # 设计文档 + 实施计划
```

别名：`@/*` → `src/*`。

## 🔐 环境变量

复制 `.env.example` 为 `.env`，最少需要：

| 变量                                    | 含义                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`                          | Postgres 连接串，例：`postgresql://shr:shr_dev_pwd@localhost:5432/shr?schema=public` |
| `NEXTAUTH_SECRET`                       | NextAuth JWT 签名密钥（**生产必改**，至少 32 字节随机）                              |
| `NEXTAUTH_URL`                          | 站点公网地址，例：`https://shr.example.gov.cn`                                       |
| `MINIO_ENDPOINT` / `MINIO_PORT`         | MinIO 地址 / 端口                                                                    |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO 凭据                                                                           |
| `MINIO_BUCKET`                          | 照片桶名（首次启动需提前创建）                                                       |
| `TZ`                                    | 时区，例：`Asia/Shanghai`                                                            |
| `SYNC_BASE_URL`                         | 客户端同步回调的 base URL（一般与 `NEXTAUTH_URL` 一致）                              |

详见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

## 🧪 测试

### 单元（Vitest）

- **范围**：`src/services/` + `src/lib/` + `src/workers/`，14 个文件 / 93 用例。
- **阈值**（v8）：lines 25% / functions 23% / branches 17% / statements 25%。当前实际远超阈值。
- **覆盖矩阵**：

| 层级           | 覆盖范围                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------- |
| `services/`    | `case`（register / getById / list / transitionStatus）、`review`（claim / takeOver / submit）、`audit`（lock / sign / reject）、`stats`（KPI / trend / distribution）、`import`（Excel 解析 + 失败回显）、`photo`（upload / signedUrl / delete / attachToReview）、`sync`（队列 upsert / 重试 / 阈值）、`notification`（create / broadcast / list / markRead）、`state-machine`、`case-code-generator` |
| `lib/`         | `api-error`（problem / handleError + BusinessError + Zod 分支）、`cron`（validate / register / start / 错误吞掉）、`permissions`（`can` 角色矩阵 + `assertCan`） |
| `workers/`     | `scanRecycle`（释放空闲 review 锁 / case 锁 + audit + 通知）、`scanDeadlines`（临期 / 逾期 + 群发科长 + 当日去重） |

- **运行**：`npm test`（一次性）/ `npm run test:watch` / `npm run test:cov`（HTML 报告输出到 `coverage/`）。

### E2E（Playwright）

- 场景：登录 / 全流程 happy path / 驳回 + 重交 / 离线同步。
- 运行：`npm run test:e2e`（需 dev server + seeded DB）。
- CI 在 PR 与 main 推送时跑。

### 手动冒烟

监管员登记 → 复核（含拍照）→ 科长审核通过 / 驳回 → 销案 / 重新复核。

## 🏗 架构要点

- **状态机集中** — `src/services/state-machine.ts` 是单一事实源，所有 `Case` 状态转移走这里。
- **并发安全** — 审核阶段用 `SELECT ... FOR UPDATE` + `lockedById / lockedAt` 抢锁；复核侧用 `claimedById / claimedAt / lastActiveAt` 支持接管。
- **离线优先** — 客户端 IndexedDB 缓存草稿 + 照片 + 操作队列；`pwa/sync-worker.ts` 指数退避重连；`POST /api/sync/notify-failed` 把同步失败上报到 `Notification`。
- **PWA 仅生产** — `next.config.ts` 里 `disable: NODE_ENV === 'development'`，避免 dev 模式脏缓存。
- **进程内 cron** — `src/instrumentation.ts` 在 Next 启动时注册通知（08:00）+ 回收（02:00）两个任务。**单实例部署**：多实例需外置锁或改用外部 scheduler。

## 🚢 部署

生产部署指南（Docker / 反向代理 / 备份 / 监控 / 升级）见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

## 🤝 贡献

- 提交规范：Conventional Commits，scope 形如 `feat(api):` / `feat(pwa):` / `feat(ui):` / `fix(types):` / `test(e2e):` / `chore(test):` / `ops:`。
- 主题 ≤ 72 字符，祈使句，不加句号。
- 提 PR 前：`npm test` + `npm run test:e2e` + 必要时附 UI 截图，schema / env 变动要明确写出。

## 📄 许可

本仓库为内部项目，未经授权不得外发。
