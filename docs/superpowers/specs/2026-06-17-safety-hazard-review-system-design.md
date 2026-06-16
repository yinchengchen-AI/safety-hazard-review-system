# 安全生产隐患复核系统 — 设计文档

> 状态：草稿 v0.1
> 日期：2026-06-17
> 项目代号：safety-hazard-review-system

## 1. 背景与目标

应急管理局对企业安全生产隐患整改情况进行督查和复核。现状：监管员靠纸面材料、邮件、Excel 跟踪整改进度，证据散落，签字与销案留痕不规范，统计靠人工。

目标：把"接收证据 → 现场复核 → 科长审核签字 → 销案"全流程搬到线上，让监管员 / 科长有统一工作台，局长有看板，整改闭环结构化、可追溯、可统计。

**非目标**：隐患排查、检查计划、整改通知下达、企业自查上报——这些由其他系统负责，本系统只做"复核"环节。

## 2. 范围与决策记录

| # | 决策 | 选择 | 备选 | 理由 |
|---|---|---|---|---|
| 1 | 服务对象 | 应急管理局监管端 | 含企业端、监管+企业 | 应急局是核心用户 |
| 2 | 业务范围 | 仅复核环节 | 含检查 / 通知 | 检查和通知有专门系统 |
| 3 | 案件入口 | 监管员手工登记 + Excel 批量导入 | 企业在线申报 | 监管员统一录入，便于标准化 |
| 4 | 审核流程 | 两级：监管员复核 → 科长审核签字 | 单级 / 三级 | 贴合多数地方应急局现状 |
| 5 | 平台 | PWA 响应式 | 纯 Web / Web+原生 App | 一套代码覆盖 PC + 手机 |
| 6 | 租户 | 单局 | 多级贯通 | 起步单局，结构可平滑扩展 |
| 7 | 复核表单 | 结构化清单（按隐患类型加载） | 极简 / 模板化 | 留痕最完整 |
| 8 | 整改期限 | 站内提醒（临期 3 天 / 超时升级） | 仅标记 / 自动改派 | 不自动改派，留人为干预 |
| 9 | 工作台 | 标准工作台（数字 + 趋势 + 分布 + 待办） | 极简 / 完整驾驶舱 | 覆盖日常 |
| 10 | 部署约束 | 无硬约束 | 政务云 / 信创 | 起步简单，未来可加 |
| 11 | 技术栈 | Next.js 15 + TypeScript + Prisma + PostgreSQL + NextAuth + shadcn/ui + Tailwind + PWA + MinIO | 前后端分离 | 端到端 TS、迭代最快 |
| 12 | 照片存储 | MinIO 自建 | 阿里云 OSS / 政务云对象存储 | 起步自建可控 |
| 13 | 离线缓存 | v0.1 就要 | v0.2 再加 | 现场网络差 |
| 14 | 通知 worker | v0.1 进程内 cron | 独立 worker | v0.1 简化 |
| 15 | Case 中间态 | 加「审核中」 | 仅有「待审核」 | 区分"在队列"和"已领取" |
| 16 | Review 历史 | 每次提交新建一条 | 复用同一条 | 保留完整审计历史 |

## 3. 架构

### 3.1 部署形态

- Next.js 15 单一 Node 进程承担前后端（App Router + API Routes + NextAuth）
- PostgreSQL 16 存业务数据
- MinIO 自建对象存储存照片
- PWA：手机端离线缓存 + 在线同步
- 通知：进程内 cron + 后台 worker（v0.1 进程内；v0.2 拆独立 worker）

### 3.2 模块划分

- **App Router** — 页面、Server Components、Server Actions
- **API Routes** — REST 端点（登记、复核提交、审核签字、导入、照片上传、离线同步）
- **NextAuth** — 账号密码 + 角色
- **Services 层** — 业务核心（Case、Review、Audit、Import、Photo、Notification、Stats、Sync）
- **Prisma** — ORM
- **lib/** — Prisma 单例、MinIO client、auth 配置、权限矩阵、错误处理

### 3.3 角色与终端

| 角色 | 终端 | 主要动作 |
|---|---|---|
| 监管员 | 手机 / 平板（PWA） | 现场拍照、填清单、提交复核 |
| 科长 | PC 浏览器 | 审核、签字、驳回 |
| 局长 | PC 浏览器 | 看统计、看板 |
| 系统管理员 | PC 浏览器 | 用户/企业/类型/模板管理 |

## 4. 数据模型

### 4.1 核心实体（15 表 + 1 离线表）

| 表 | 关键字段 |
|---|---|
| User | id, name, email, passwordHash, role(监管员/科长/局长/管理员), status |
| Enterprise | id, name, 统一社会信用代码, industry, address, contactName, contactPhone |
| HazardType | id, code, name, category(消防/特种设备/危化品/电气/...), parentId（树）, sortOrder, active |
| ChecklistTemplate | id, hazardTypeId, name, version, active, createdById |
| ChecklistItem | id, templateId, content, sortOrder, required, evidenceRequired |
| Case | id, code(工单号), enterpriseId, hazardTypeId, severity(重大/较大/一般), source, description, address, gpsLat, gpsLng, deadline, status, registeredById, registeredAt, closedAt, **lockedById, lockedAt** |
| CaseAttachment | id, caseId, type(整改前/后/其他), storageKey, originalName, mimeType, sizeBytes, uploadedById |
| Review | id, caseId, reviewerId, status(in_progress/submitted/returned), startedAt, submittedAt, conclusion(通过/不通过/部分通过), summary, score |
| ReviewItemResult | id, reviewId, itemId, result(pass/fail/na), note |
| ReviewPhoto | id, reviewId, storageKey, takenAt, gpsLat, gpsLng, capturedById, syncStatus(local/synced) |
| AuditSignature | id, caseId, auditorId, decision(通过/驳回), comment, signatureUrl, signedAt |
| Notification | id, userId, type(临期提醒/超时提醒/审核通知/...), refType, refId, title, body, readAt |
| ImportBatch | id, filename, uploadedById, totalRows, successCount, failedCount, status |
| ImportError | id, batchId, rowNumber, field, value, message |
| AuditLog | id, userId, action, targetType, targetId, payload, ipAddress, createdAt |
| OfflineSyncQueue | id, userId, opType, payload(jsonb), status(pending/synced/failed), retryCount, createdAt, syncedAt |

### 4.2 索引与约束

- 唯一：User.email、Enterprise.统一社会信用代码、HazardType.code
- 索引：Case.status、Case.deadline、Case.enterpriseId、Case.hazardTypeId、Case.lockedById
- 外键策略：删除 HazardType → 关联的 ChecklistTemplate / Case 保留，禁止再引用该类型

### 4.3 Case 状态机

> 「待登记」是前端 form 会话态，不入库；提交后 Case.status 初始值 = `待复核`。

```
（前端草稿，不入库）
       ↓ 提交
   待复核  →  待审核  →  审核中  →  已销案
              ↑   ↓ 驳回
              └───┴─→  待复核（新建 Review 保留历史）
```

- 监管员提交登记 → Case.status = `待复核`
- 监管员提交 Review → Case.status = `待审核`
- 科长点开案件（任一科长，first-open 锁定，其他人只读） → Case.status = `审核中`
- 科长通过 + 签名 → Case.status = `已销案`，写 `AuditSignature`
- 科长驳回 + 理由 → Case.status = `待复核`，原 Review.status = `returned`，新一轮等待
- 临期 / 超时通知收件人 = `Case.registeredById`（即创建该案件的监管员）

## 5. 关键流程

### 5.1 案件登记

监管员在 `/cases/new` 填写（企业、隐患类型、严重程度、描述、地址、整改期限等）→ 校验 → 保存 → 状态 = 待复核。

### 5.2 批量导入

监管员在 `/cases/import` 上传 Excel → 解析 + 逐行校验 → 展示错误预览 → 确认导入 → 写入 `ImportBatch` + 多个 `Case` → 错误行写入 `ImportError`。

Excel 模板字段（v0.1）：企业名称、统一社会信用代码、隐患类型编码、严重程度、隐患来源、描述、地址、整改期限。

### 5.3 复核流程

监管员在 `/cases/[id]/review` 填清单（按 Case.hazardTypeId 加载 ChecklistTemplate）→ 逐项 pass/fail/N/A + 备注 + 现场拍照 → 写总体结论（通过/不通过/部分通过） + 说明 → 提交 Review → Case 状态 = 待审核。

### 5.4 审核流程

任一科长在 `/cases/[id]/audit` 点开 → 服务端用 `SELECT ... FOR UPDATE` 锁定该 Case → Case.status = `审核中` 并写入 `lockedById` + `lockedAt`；其他科长进入只读模式，提示"已被 X 科长领取"。查看证据照片 + 监管员结论 + 各项结果 → 通过 + 签名（Case = `已销案`，写 `AuditSignature`）/ 驳回 + 理由（Case = `待复核`，原 Review.status = `returned`）。

### 5.5 通知流程

进程内 cron 每天 08:00 扫描：

- deadline 距今 ≤ 3 天 → 给 assigned 监管员发"临期提醒"
- deadline 已过 → 给监管员 + 科长发"超时提醒"
- 监管员提交 Review → 给科长发"待审核通知"
- 科长通过/驳回 → 给监管员发"审核结果通知"

### 5.6 离线同步流程

- **离线时**：Service Worker 缓存已访问的案件 / 清单模板；照片 → IndexedDB blob；复核草稿 → IndexedDB；提交动作 → OfflineSyncQueue
- **联网时**：`window.online` 事件触发 → sync worker 顺序拉取 pending → 上传照片到 MinIO → 创建/更新 Review → 成功改 status=synced 并清本地副本
- **失败**：指数退避重试 3 次 → 标 failed → 推送通知给监管员 → 「我的同步」页手动重试
- **冲突**：以"最后提交成功者"为准；离线提交发现 Case.status = 已销案 → 提示"该案件已结案，无需复核"并放弃

## 6. 模块 / 页面 / API

### 6.1 页面树

```
公共
├─ /login
├─ /                              # 工作台首页（按角色渲染）
└─ /me/notifications

案件
├─ /cases                         # 列表（按状态/类型/时间筛选）
├─ /cases/new                     # 登记
├─ /cases/import                  # 批量导入
├─ /cases/[id]                    # 详情（含 Review 历史、签字记录）
├─ /cases/[id]/review             # 复核填写
└─ /cases/[id]/audit              # 审核签字

统计
└─ /stats                         # 趋势 + 行业分布 + 监管员工作量

管理
├─ /admin/users
├─ /admin/enterprises
├─ /admin/hazard-types
├─ /admin/checklist-templates
├─ /admin/audit-log
└─ /admin/import-batches
```

### 6.2 API 路由（节选）

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | /api/cases | 案件登记 |
| GET  | /api/cases | 案件列表（分页+筛选） |
| GET  | /api/cases/[id] | 案件详情 |
| POST | /api/cases/[id]/review | 提交复核 |
| POST | /api/cases/[id]/audit | 审核签字 / 驳回 |
| POST | /api/import | 上传 + 解析 + 确认 |
| POST | /api/photos | 上传照片到 MinIO |
| POST | /api/sync | 离线同步入口 |
| GET  | /api/stats/kpi | KPI 数字 |
| GET  | /api/stats/trend | 趋势 |
| GET  | /api/stats/distribution | 分布 |
| GET  | /api/notifications | 通知列表 |
| POST | /api/auth/* | NextAuth |

### 6.3 Services 层

```ts
// services/case.ts
CaseService.register(input, userId): Case
CaseService.getById(id): Case
CaseService.list(filter, page): Page<Case>
CaseService.transitionStatus(id, from, to, actorId): void

// services/review.ts
ReviewService.start(caseId, reviewerId): Review
ReviewService.saveItem(reviewId, itemId, result, note): void
ReviewService.submit(reviewId, conclusion, summary, photos): Review

// services/audit.ts
AuditService.sign(caseId, auditorId, decision, comment, signatureUrl): AuditSignature
AuditService.reject(caseId, auditorId, reason): void

// services/import.ts
ImportService.parseExcel(buffer): { rows, errors }
ImportService.validate(rows): { valid, errors }
ImportService.commit(rows, batchId, userId): ImportBatch

// services/photo.ts
PhotoService.upload(buffer, mime, meta): { storageKey, signedUrl }
PhotoService.getSignedUrl(storageKey, ttl): string
PhotoService.delete(storageKey): void

// services/notification.ts
NotificationService.create(userId, type, ref): void
NotificationService.list(userId, page): Page<Notification>
NotificationService.markRead(id, userId): void

// services/stats.ts
StatsService.kpi(scope): KpiSnapshot
StatsService.trend(scope, range): TrendSeries
StatsService.distribution(scope, by): Distribution

// services/sync.ts
SyncService.processQueue(userId): void
SyncService.retry(itemId): void
```

## 7. 错误处理 & 安全

- **API 错误**：自定义 `BusinessError(code, message, httpStatus)`；统一响应 problem+json
- **前端错误**：SWR 自动重试 GET；写操作失败 toast + 引导重试
- **离线错误**：失败 3 次标 failed → 推通知 → 手动重试
- **权限**：角色 → 权限矩阵；服务端强制校验
- **审计**：登录、登记、提交、签字、驳回、导入、管理操作全写 `AuditLog`
- **照片**：走 MinIO 签名 URL（v0.1：服务端代理下载 + 鉴权；v0.2：临时签名 URL）
- **密码**：bcrypt 哈希
- **CSRF**：NextAuth 内置

## 8. 测试

- **单元**：Vitest + Testing Library，services/ + lib/，覆盖率目标 ≥ 80%
- **集成**：API 端点用 vitest + supertest
- **E2E**：Playwright，关键流程（登录、登记、批量导入、复核、审核、驳回、离线同步）
- **测试数据**：testcontainers 起真实 PG + MinIO；工厂函数构造数据

## 9. 运维

- **部署**：Docker Compose 一键起（pg + minio + app + nginx）
- **日志**：pino 结构化日志 → stdout
- **健康检查**：`GET /api/health` 返回 PG / MinIO 状态
- **备份**：PG 每日逻辑备份 + MinIO 异地同步（v0.2）
- **CI**：GitHub Actions（lint + type-check + test + build）
- **环境变量**：`DATABASE_URL`、`MINIO_*`、`NEXTAUTH_SECRET`、`SYNC_BASE_URL`（前端调用后端用）、`TZ=Asia/Shanghai`
- **时区**：DB 用 `TIMESTAMPTZ`（UTC 存储），UI 一律 `Asia/Shanghai` 展示；cron 在容器时区为 `Asia/Shanghai` 下运行

## 10. 后续待办（实施前必做）

- [ ] 初始化隐患类型库（消防 / 特种设备 / 危化品 / 电气 / ...），按 GB 标准对齐
- [ ] 预置 ≥ 5 套复核清单模板（每种隐患类型一套）
- [ ] 设计 Excel 导入模板（字段、格式、校验规则）
- [ ] 定义角色权限矩阵（监管员 / 科长 / 局长 / 管理员）
- [ ] 细化离线冲突场景的边界
- [ ] 数据迁移 / 备份恢复演练脚本
- [ ] 等保测评（如果后续上政务云）

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 隐患类型库 / 模板内容不完整 | 上线后频繁补 | 由客户业务专家在 v0.1 启动前提供初版 |
| 离线同步冲突边界模糊 | 监管员误覆盖 | 服务端事务 + 状态校验 + 明确错误提示 |
| 照片存储增长快 | 存储成本 | v0.2 加对象存储生命周期 + 缩略图 |
| 等保 / 信创后续要求 | 可能要重构 | 当前架构用 PostgreSQL，迁达梦/人大金仓有 Prisma adapter 路径 |
