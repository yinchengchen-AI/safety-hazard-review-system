# 全面代码审查报告 — 2026-07-17

## 概览

- **审查范围**：`apps/backend` 全量（约 4300 行 NestJS 源码 + Prisma schema/迁移/seed）、`apps/frontend` 核心 lib（api/auth/errors + 中间件 + 登录 + dashboard layout）、`nginx.conf`、`docker-compose.prod.yml`、`migrate.sh`、`init-env.sh`、`auto-deploy.py`、后端/worker Dockerfile。
- **审查方法**：静态阅读全部核心模块源码，未运行构建 / 测试 / 部署。
- **审查维度**：安全漏洞、业务逻辑一致性、架构与性能、可观测性、部署。
- **关键发现数量**：**P0 = 7 条**（必须立即修，多数阻塞上线），**P1 = 14 条**（上线前必须修），**P2 = 12 条**（中期改进）。

> 严重度定义：
> - **P0**：可造成越权访问 / 数据泄露 / 数据丢失 / 服务不可用 的安全或一致性缺陷。
> - **P1**：可触发一致性、性能、可观测性、部署风险的缺陷，未直接产生安全洞但会扩大事故面。
> - **P2**：代码质量、可维护性、可演进性问题；不影响当前生产可用性。

---

## P0 — 必须立即修

### P0-1 `photos.serveLegacy` 任意已登录用户可访问任意照片（隐私越权）
- **文件**：`apps/backend/src/modules/photos/photos.service.ts:120-130`、`apps/backend/src/modules/photos/photos.controller.ts:71-90`
- **触发条件**：拿到任意 photo UUID（泄露在旧报告 / 任务列表 / 日志中），用任意已登录 JWT 拼 `/api/v1/photos/<id>/image?size=original&token=<jwt>` 即可下载照片（即使该照片已绑定到他人任务或仍为待上传临时图）。`serveLegacy` 只校验 `users.is_active`，未校验 photo 与当前 user 的所有权关系。
- **影响面**：隐私数据泄露；含隐患现场图、企业内部设施等敏感信息。
- **修复建议**：
  1. 删除 `?token=<jwt>` 兼容路径（AGENTS.md 已注明 1 个发布周期后下线），强制走 HMAC 签名。
  2. 即便保留，也要按 `task_hazards` → `review_tasks.creator_id` 或上传者 `user_id` 校验所有权（`photos` 表当前没有 uploader 字段，需新增 `uploader_id` 并在 upload 时写入）。
- **覆盖测试**：无。`photos.e2e-spec.ts` 没有跨用户访问测试。

### P0-2 `reports.controller.ts:download` 任意已登录用户可下载任意任务报告
- **文件**：`apps/backend/src/modules/reports/reports.controller.ts:46-72`
- **触发条件**：凭 UUID 拼 `/api/v1/reports/<taskId>/download?format=pdf`，仅 `JwtAuthGuard + ActiveUserGuard`，无 task-level 权限校验。
- **影响面**：报告含隐患详情、企业信息、复核结论，属敏感数据；泄露后等同数据外泄。
- **修复建议**：在 controller 中校验 `review_tasks.creator_id === currentUser.id || currentUser.role === 'admin'`，或对 `task_hazards` 做权限检查。返回 403 而非 404 防止枚举。
- **覆盖测试**：无。`reports.e2e-spec.ts` 未涉及跨用户下载。

### P0-3 `photos.bind` 可把他人上传的照片挂到任意 `task_hazard_id`
- **文件**：`apps/backend/src/modules/photos/photos.controller.ts:46-58`、`apps/backend/src/modules/photos/photos.service.ts:108-122`
- **触发条件**：上传图片后获得 `temp_token`（128 位 UUID），调 `/api/v1/photos/<temp_token>/bind` 并 POST `{ task_hazard_id: <任意> }`。`bind` 不校验 task 所有权 / 状态。
- **影响面**：污染他人复核任务的证据链；可冒充他人现场取证。
- **修复建议**：`bind` 时校验 `task_hazards.review_tasks.creator_id === currentUser.id` 或 `role === 'admin'`，且 task 仍处于 `pending` 状态。当前 schema 上 `photos.uploader_id` 缺失，建议新增并在 upload 时绑定上传者，bind 时校验一致性。
- **覆盖测试**：无。`photos.e2e-spec.ts` 只测了 admin 自身的 bind 路径。

### P0-4 `review-tasks.complete()` 双重入队报告竞态
- **文件**：`apps/backend/src/modules/review-tasks/review-tasks.service.ts:277-330`
- **触发条件**：同一 taskId 上并发两个 `POST /review-tasks/:id/complete` 请求。两次都过应用层 `status !== 'pending'` 校验（先查后写），都进入 `updateMany(hazards)` 与 `update(task)`，并两次都触发 `reports.createAndEnqueue(task.id, { force: false })`。第二次进入时 `reports.status === 'pending'`，按 `createAndEnqueue` 的语义应 no-op，但第二次写 `task.status = 'completed'` 仍可能竞争。`completed_at` 字段会被两次更新。通知也双发（虽然 `notifications.notify` 去重可缓解）。
- **影响面**：报告被双生成（虽然 BullMQ `jobId` 去重兜底，但 `reports.status` 短暂停留在 `processing` 时若失败再重试，可能产生两份 PDF/Word 文件占用存储）。任务完成时间被覆盖。
- **修复建议**：把"释放 hazard 锁 + 更新 task 状态"包到 `$transaction`，并用 `WHERE status = 'pending'` 做 SQL 层的 CAS：`prisma.review_tasks.updateMany({ where: { id, status: 'pending' }, data: { ... } })`，受影响行数为 0 则说明已被并发完成，直接返回当前状态。
- **覆盖测试**：`review-tasks.e2e-spec.ts` / `review-tasks-complete.e2e-spec.ts` 未覆盖并发场景。

### P0-5 `reports.createAndEnqueue` force 路径无法真正重跑
- **文件**：`apps/backend/src/modules/reports/reports.service.ts:32-50`
- **触发条件**：操作员调 `POST /reports/<taskId>/generate`（`force: true`）想重跑一个 `completed` 的报告。当前实现命中 `else { reportId = existing.id }`，**不重置 `status` / `pdf_path` / `word_path` / `error_message`**。worker 启动后第一道防御是 `if (current.status === 'completed') return`，直接跳过 → 操作员的"强制重跑"等于空操作。
- **影响面**：报告内容错误或数据更新后无法重新生成，需手动改数据库。
- **修复建议**：在 force 分支显式重置：`status: 'pending'`、`pdf_path: null`、`word_path: null`、`error_message: null`，并同步删 MinIO 上的旧文件。
- **覆盖测试**：无。

### P0-6 `report-renderer` Playwright Chromium 中文渲染为方块（功能性 P0）
- **文件**：`apps/backend/src/queues/report-renderer.ts:25-60`、`apps/backend/Dockerfile.worker`
- **触发条件**：worker 容器执行 PDF 生成；`node:20-alpine` 镜像不含任何 CJK 字体。CSS 指定 `font-family: 'Noto Sans CJK SC','Microsoft YaHei',sans-serif`，实际可用的只有 `sans-serif`（DejaVu），最终 PDF 中所有中文字符显示成 □□。
- **影响面**：报告全部不可读，对客户交付来说是 P0 功能故障。
- **修复建议**：
  1. 在 `Dockerfile.worker` 增加 `apk add --no-cache font-noto-cjk fontconfig` 并在构建后 `fc-cache -fv`；或挂载预制字体目录。
  2. 升级 base image 到 `node:20-bookworm-slim` 配 `fonts-noto-cjk`。
  3. 集成测试：跑一次真实 PDF 生成并 OCR / 视觉检查。
- **覆盖测试**：无 E2E 跑 Playwright（仅 `app.module` 链路注册）。

### P0-7 `bullmq.module.ts` 忽略 Redis 密码
- **文件**：`apps/backend/src/queues/bullmq.module.ts:5-8`
- **触发条件**：生产 Redis 启用 ACL / requirepass（推荐做法）。`new URL(REDIS_URL).password` 被丢弃，BullMQ 连接裸 TCP，认证失败后 worker / API 端队列操作全部抛错，报告生成任务堆积失败。
- **影响面**：异步任务系统静默失效，没有健康检查能覆盖（`/health/ready` 只查 Postgres）。
- **修复建议**：
  ```ts
  const url = new URL(config.get<string>('REDIS_URL'));
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
  ```
- **覆盖测试**：无。

---

## P1 — 上线前必须修

### P1-1 多处 `page_size` 无上限（DoS 风险）
- **文件**：
  - `apps/backend/src/modules/hazards/hazards.controller.ts:23` (`list`)
  - `apps/backend/src/modules/batches/batches.controller.ts:34` (`list`)
  - `apps/backend/src/modules/notifications/notifications.controller.ts:17` (`list`)
  - `apps/backend/src/modules/users/users.controller.ts:34` (`list`)
  - `apps/backend/src/modules/enterprises/enterprises.controller.ts:36` (`list`)
  - `apps/backend/src/modules/audit-logs/audit-logs.controller.ts`（DTO 上限 1 但无上限）
- **触发条件**：发请求 `?page_size=1000000`，Prisma 一次拉百万行导致内存 OOM 或 DB 慢查询。
- **修复建议**：在 DTO 加 `@Max(200)`（或 `@Max(100)`），或封装 `PaginationPipe` 统一限速。`audit-logs` 查询尤其需要分页（建议 `@Max(100)`）。

### P1-2 `enterprises.exportToBuffer` 全量加载 + 单 Excel（OOM）
- **文件**：`apps/backend/src/modules/enterprises/enterprises.service.ts:124-152`
- **触发条件**：企业表行数过万后，`findMany` 一次拉到内存再 `wb.xlsx.writeBuffer()`，ExcelJS 全在内存。Node 默认堆 ~1.7GB。
- **修复建议**：用流式写入（`wb.xlsx.writeBuffer` 改为 `wb.xlsx.write(stream)` 流到 `res`），或加 `LIMIT` 分批。生产场景建议加导出任务 + BullMQ 异步生成 + 下载链接。

### P1-3 `batches.import` 多阶段非原子
- **文件**：`apps/backend/src/modules/batches/batches.service.ts:131-205`
- **触发条件**：worker 进程在 `_processRow` 中途被 kill（OOM / SIGKILL / 节点重启），可能留下 `batches.success_count=0, fail_count=0` 但表里已有 hazards 的孤儿 batch，行级 `import_errors` 与 `hazards` 表状态不一致。
- **影响面**：批次统计不可信；后续 batch 删除会级联删除未预期的 hazards。
- **修复建议**：把 `batches.create`、MinIO 上传、行级处理包到 `$transaction`（用 `tx.batches.update` 而非另起事务）。对超大批次，可接受"批次失败 = 已写入的 hazards 也回滚"。

### P1-4 `enterprises.name` 无唯一约束（重复企业）
- **文件**：`apps/backend/prisma/schema.prisma:48-63`
- **触发条件**：Excel 导入中两个并发请求都用 name（无 credit_code）创建企业；`uix_enterprises_credit_code` 只对非 NULL `credit_code` 生效。两条 INSERT 都成功，产生两个同名企业，隐患被分散到不同 enterprise_id 下，统计/复核都错位。
- **修复建议**：仿 `credit_code` 加一个部分唯一索引 `WHERE name IS NOT NULL AND deleted_at IS NULL`（注意 `name NOT NULL` 应先确认 schema，目前 `name` 是 `String` 非空，可行）。migration 同样需要先合并历史重复数据。

### P1-5 登录限流键仅 IP，未绑定 username
- **文件**：`apps/backend/src/modules/auth/auth.controller.ts:28-32`、`@nestjs/throttler`
- **触发条件**：攻击者通过代理池或 X-Forwarded-For 伪造每分钟 5 个 IP，对同一个 username 做凭证填充；或反过来单个 IP 同一时刻只允许 5 个不同用户登录。
- **修复建议**：在 `AuthService.login` 自实现 IP+username 复合键的 Redis 计数器（与 `@nestjs/throttler` 解耦，因为 Throttler 装饰器只接受方法级粒度）。`/auth/login` 装饰器参数仅做粗粒度兜底。

### P1-6 JWT 有效期 8 小时 + 无 refresh / 无吊销
- **文件**：`apps/backend/src/modules/auth/auth.service.ts:35`、`apps/backend/src/config/env.schema.ts:18-21`
- **触发条件**：用户设备丢失 / 密码泄露后无法即时吊销旧 token，必须等 8 小时过期。
- **修复建议**：缩短到 30-60 分钟 + 引入 refresh token（httpOnly cookie + rotation）；或维护 `token_version` 字段在 users 表，`validate` 时比对。

### P1-7 `AllExceptionsFilter` 审计写入 fire-and-forget
- **文件**：`apps/backend/src/common/filters/all-exceptions.filter.ts:79-92`
- **触发条件**：DB 抖动或 Redis 限流时 `audit.record(...)` 静默失败（`.catch(() => undefined)`），关键 4xx/5xx 请求的取证数据丢失。
- **修复建议**：把审计写入失败上报 Prometheus 计数器（`audit_write_failures_total`）便于监控；或落本地 fallback 文件队列待后续补偿。至少 logger.error 输出而不是 silent。

### P1-8 缺失关键业务操作的 audit log
- **文件**：
  - `review-tasks.service.ts:46-130` (`create`) — 无 audit log
  - `review-tasks.service.ts:339-403` (`cancel`) — 无 audit log
  - `review-tasks.service.ts:277-337` (`complete`) — 无 audit log
  - `enterprises.service.ts:84-93` (`update`) — 无 audit log
  - `batches.service.ts:328-360` (`remove`) — 在事务外记录但事务内删除，事务回滚时审计仍写 → 误报
- **影响面**：管理操作无法追溯；监管场景（安全隐患复核）合规风险。
- **修复建议**：在 service 内显式 `this.audit.record({ action: 'review_task.create'/'cancel'/'complete', ... })`。`batches.remove` 把 audit 移入事务；或事务提交后再写 audit 并接受偶发漏写（提高优先级用前者）。

### P1-9 `photos.delete` 鉴权宽 + 状态机不全
- **文件**：`apps/backend/src/modules/photos/photos.service.ts:163-184`
- **触发条件**：任何 active 用户都可 DELETE `/api/v1/photos/:id`；只校验 task 状态 `!== 'pending'`，未校验上传者。已绑定到 `pending` 任务的临时照片可被任意人删除。
- **修复建议**：限制 `currentUser.id === photo.uploader_id || role === 'admin'`（需要 `photos.uploader_id` 字段，见 P0-3）。

### P1-10 软删除中间件只覆盖只读动作，不覆盖 relation
- **文件**：`apps/backend/src/prisma/soft-delete.middleware.ts:23-50`
- **触发条件**：`review_tasks` / `batches` / `enterprises` / `users` 软删后，`hazards.findMany({ where: { enterprise_id } })` 不会过滤软删企业（Prisma 不会自动过滤 relation 上游的 `deleted_at`）。多数代码路径不显式过滤，下游统计可能把已软删企业的隐患也算入。
- **修复建议**：
  1. 在 service 内所有 `findMany` / `count` 涉及 enterprise / batch / user 的查询显式 `where: { enterprise: { deleted_at: null }, batch: { deleted_at: null } }`。
  2. 或在 schema 加 `@@middleware` 拦截器，对所有 `findMany` / `count` 自动注入 relation 过滤。

### P1-11 `frontend/middleware.ts` 在 Edge runtime 验证 JWT
- **文件**：`apps/frontend/src/middleware.ts:28-40`
- **触发条件**：`SECRET_KEY` 必须能传到 Edge 函数。如果 Next.js 构建时把 `SECRET_KEY` 当成非 `NEXT_PUBLIC_*` 变量注入 client bundle（取决于 `next.config.js` 的 env 配置），存在泄露风险。
- **修复建议**：显式在 `next.config.js` 把 `SECRET_KEY` 加入 `serverRuntimeConfig` 而非 `env`，并在 `middleware.ts` 用 `process.env.SECRET_KEY ?? ''` 强校验缺失即失败；当前 `new TextEncoder().encode('')` 在 SECRET_KEY 缺失时会让所有 JWT 验证失败但不会启动期 fail。建议在 `next.config.js` 中 `if (!process.env.SECRET_KEY) throw new Error(...)`。

### P1-12 `statistics_daily` / `statistics_monthly` `@@unique` 对全 NULL 不约束
- **文件**：`apps/backend/prisma/schema.prisma:200-235`
- **触发条件**：PG 的 B-tree 默认下 NULL 互不相等，`@@unique([stat_date, enterprise_id, batch_id, inspector_id])` 不会防止"全 NULL 重复行"。`rollupDaily` 用 `deleteMany` + `create` 靠应用层去重，应用层 OK；但 schema 注释 `uix_stats_daily` 名不副实，未来加并发或多服务调用会出问题。
- **修复建议**：仿 `uix_enterprises_credit_code` 改用 `CREATE UNIQUE INDEX ... WHERE stat_date IS NOT NULL AND enterprise_id IS NULL AND batch_id IS NULL AND inspector_id IS NULL` 的部分索引；或彻底改为 `(stat_date, COALESCE(enterprise_id, '00000000-0000-0000-0000-000000000000'), ...)`。

### P1-13 BullMQ Redis 健康无独立探活
- **文件**：`apps/backend/src/modules/health/health.controller.ts:35-45`、`apps/backend/src/queues/bullmq.module.ts`
- **触发条件**：`/health/ready` 只查 Postgres；Redis 挂掉后队列全部堆积但健康检查仍 200。P0-7 触发后此问题更明显。
- **修复建议**：在 `HealthController.readiness` 中 `await this.queue.client.ping()`（注入 BullMQ Queue），失败也返 503。

### P1-14 `photo` 签名 URL 一旦泄漏即被滥用
- **文件**：`apps/backend/src/storage/url-signer.service.ts:31-36`
- **触发条件**：签名 URL 在 TTL（15 分钟）内被浏览器 Referer 头 / 代理日志 / 抓包捕获即可重放访问；`Cache-Control: private, max-age=300` 只控制浏览器缓存。
- **修复建议**：
  1. 在签名 payload 加入客户端 hint（如 `userAgent` 前 8 字节 hash），服务端校验一致性（不能完全防 Referer 泄漏，但至少增加复用门槛）。
  2. 服务端日志：Nginx access log 配置 `log_format` 去掉 query string（目前 `proxy_pass` 默认带 query，URL 含 sig 会被记录）。
  3. 把 TTL 缩短到 60-120 秒；或在签名中绑 `task_hazard_id` 让 sign URL 绑死资源。

---

## P2 — 中期改进

### P2-1 `type HazardJoined = any` / `type BatchJoined = any` / `type ReviewTaskJoined = any`
- **文件**：`hazards.service.ts:25`、`batches.service.ts:24`、`review-tasks.service.ts:13`、`photos.service.ts:...`
- **修复建议**：改为 `Prisma.hazardsGetPayload<{ include: { enterprises: true; batches: true } }>`。

### P2-2 `storage.service.ts:randomId()` 使用 `Math.random()`
- **文件**：`apps/backend/src/storage/storage.service.ts:104-106`
- **修复建议**：改 `crypto.randomUUID()` 或 `crypto.randomBytes(16).toString('hex')`，并把 randomId 收窄到只用做对象 key 后缀。

### P2-3 `notification_cleanup` 同时注册了 BullMQ processor + @nestjs/schedule Cron
- **文件**：`apps/backend/src/queues/notification-cleanup.processor.ts:18-44`
- **触发条件**：当 `ENABLE_CRON=true`（worker 默认开启）时，cron 每天 03:00 跑；同时 BullMQ 队列若被消费也会跑。结果可能双次清理（虽然 updateMany 幂等）。
- **修复建议**：保留一种实现即可；推荐用 cron，BullMQ 入口可改为调用 `scheduledCleanup()`。

### P2-4 `report.processor.ts:concurrency: 1` + 每次 launch 浏览器
- **文件**：`apps/backend/src/queues/report.processor.ts:13`、`apps/backend/src/queues/report-renderer.ts:38-60`
- **修复建议**：
  1. 抽 `BrowserPool` 复用 chromium 实例（每 worker 持 1 个 + context per job）。
  2. concurrency 提到 2-4（视内存）。
  3. PDF/Word 渲染改为 `puppeteer-core` + 共享 Chromium 路径。

### P2-5 `review-tasks.batchReview` 一个失败整批回滚
- **文件**：`apps/backend/src/modules/review-tasks/review-tasks.service.ts:286-308`
- **修复建议**：把每条 item 包到 `savepoint` 或拆成"成功记录逐条持久化 + 失败项收集返回"。

### P2-6 `enterprises.importRows` 无事务 / 单条 N 次查询
- **文件**：`apps/backend/src/modules/enterprises/enterprises.service.ts:107-122`
- **修复建议**：包 `$transaction`；对 name / credit_code 用 `groupBy` + 一次性 batch 查询替代逐条 findFirst。

### P2-7 前端 30 秒轮询无 visibility 暂停
- **文件**：`apps/frontend/src/app/(dashboard)/layout.tsx:84-90`
- **修复建议**：用 `document.visibilityState` 监听切到后台时清 `setInterval`，回到前台重启。可降低 Redis 计数查询压力。

### P2-8 `worker.ts` 强行覆盖 `process.env.ROLE`
- **文件**：`apps/backend/src/queues/worker.ts:17`
- **影响**：与 `app.module.ts:31` 的 `process.env.ROLE ?? 'worker'` 重复，且无条件 `??` 赋值（不是 `===` 检查）只在 ROLE 未设时才改，没问题；但与 docker-compose.prod.yml 的显式 `ROLE: worker` 矛盾。建议删除 worker.ts 的覆盖，仅依赖部署配置。

### P2-9 Playwright Chromium 未配置 sandbox 参数
- **文件**：`apps/backend/src/queues/report-renderer.ts:42`
- **修复建议**：Docker 中需要 `chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })`；同时 worker 容器以非 root 用户运行。

### P2-10 `tasks.complete` 通知在事务外再次查询 task
- **文件**：`apps/backend/src/modules/review-tasks/review-tasks.service.ts:307-322`
- **修复建议**：把 task 信息在事务内取出，避免主流程与通知读取之间出现竞态。

### P2-11 `auto-deploy.py` 明文 SSH 密码
- **文件**：`auto-deploy.py`
- **修复建议**：改用 SSH key（`paramiko.RSAKey.from_private_key_file`），密码从环境变量 `SSH_PASSWORD` 读取且不应 echo。当前通过 `getpass.getpass()` 起码不 echo，但仍未持久化密钥。

### P2-12 `nginx.conf` 缺少 HSTS 与 CSP 进一步收紧
- **文件**：`nginx.conf:15-20`
- **修复建议**：HTTPS 启用后增加 `Strict-Transport-Security: max-age=63072000; includeSubDomains`。当前 CSP `script-src 'self'` 已有，但 `connect-src 'self' http: https:` 过宽，可改为具体 origin。

---

## 已确认无问题的关键路径（避免后续反复质疑）

- **HMAC 签名实现**：`url-signer.service.ts:42-50` 使用 `crypto.timingSafeEqual` 且先校验 exp，时序攻击面 OK。
- **JWT 提取优先级**：`jwt.strategy.ts:13-22` Bearer > cookie > `?token=`，符合迁移策略。
- **Prisma 软删除中间件覆盖范围**：`soft-delete.middleware.ts:31-50` 对 `findUnique/findMany/findFirst/count/aggregate/groupBy` 都注入 `deleted_at: null`，与 schema 中 8 张表的 `deleted_at` 列一致。
- **启动期硬阻断**：staging/production 强制拒绝默认 `admin/admin123` 与弱 `SECRET_KEY`。
- **Excel 路径处理**：`batches.service.ts:154-160` 显式 sanitize 文件名为安全字符集，防止 key 注入。
- **图片上传 MIME 校验**：`photos.service.ts:60-75` 双重校验（魔法字节 + sharp metadata），不信任客户端声明的 content-type。
- **审计敏感字段 redact**：`audit-logs.service.ts:32-48` 把 password/token/secret 等敏感键脱敏。
- **用户管理 last-admin 保护**：`users.service.ts:78-86` 防止误删唯一管理员。
- **CSRF 缓解**：`SameSite=Strict` + httpOnly + CORS 白名单三件套齐全；缺少显式 CSRF token 但 SameSite 已能挡跨站。
- **下载文件路径**：`reports.controller.ts:68`、`enterprises.controller.ts:46` Content-Disposition 使用 taskId（UUID），无路径遍历。
- **PG 迁移脚本幂等**：`migrate.sh` 跑 `prisma migrate deploy` 是幂等的；`0_init` 已 resolve。

---

## 遗留风险 / 不在本次范围

- **依赖 CVE 全量扫描**：本次仅静态读源码，未做 `npm audit` / `osv-scanner`。
- **运行时 profiling**：未启动服务跑压测；性能结论基于代码静态分析。
- **前端 Playwright E2E**：仅看 1 个 `login.spec.ts`，覆盖率远低于后端 Jest E2E。
- **PG 大表 / 索引有效性**：未看 `EXPLAIN`；建议补 `pg_stat_statements` 抽样。
- **第三方依赖升级**：`exceljs@^4`、`bcrypt@5`、`playwright` 等当前主要版本未做兼容性验证。
- **多租户隔离**：当前 schema 无 tenant 维度，所有登录用户共享数据；AGENTS.md 已说明这是单租户，不在范围。
- **数据库备份与恢复演练**：`backup.sh`（未读全文件）未在本审查内评估。
- **HTTPS / TLS 证书自动化**：nginx.conf 仅 listen 80，证书自动化流程需另开任务。

---

## 测试覆盖差距汇总（与上述 P0/P1 对照）

| 路径 | E2E 是否覆盖 |
|------|--------------|
| `POST /auth/login` 限流 | 无（应测 6 次连续失败返 429） |
| 跨用户访问 photo（legacy token 路径） | **无**（P0-1） |
| `POST /photos/:temp_token/bind` 鉴权 | **无**（P0-3） |
| `POST /review-tasks/:id/complete` 并发 | **无**（P0-4） |
| `POST /reports/:taskId/generate` force=true | **无**（P0-5） |
| Playwright PDF 实际渲染中文 | **无**（P0-6） |
| Redis AUTH 连接 | **无**（P0-7） |
| `page_size` 上限 | 无（P1-1） |
| 软删 enterprise 后下游统计 | 无（P1-10） |
| `enterprises` name 并发重复 | 无（P1-4） |

---

## 建议的下一步

1. **立即处理 P0-1 ~ P0-7**，其中 P0-6 是阻塞所有报告交付的功能缺陷，必须先修。
2. 修完后补对应 E2E（至少每条 P0 一条 `*.e2e-spec.ts` 用例）。
3. 之后逐条 P1，按业务影响排序（建议先 P1-5 / P1-6 / P1-8，关联到认证与合规）。
4. P2 在下个迭代窗口集中重构（尤其 P2-1 的 `any` 清理、P2-4 的浏览器池）。
5. **不**建议在本审查后立刻切流生产；按 docs/PHASE6_STATUS.md 的演练计划走完两轮 staging 再上。
