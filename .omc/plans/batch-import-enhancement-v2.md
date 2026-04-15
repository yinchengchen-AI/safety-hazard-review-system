# 完善和扩展批量导入功能模块（修订版 v2）

## 变更日志（相对于 v1）
- **取消 JSON 导入路径**：前端仅负责预览，确认导入时仍上传原始文件字节流，由后端统一解析，避免前后端逻辑分叉。
- **修复索引问题**：重复检测使用 `digest('sha256', content)` 和 `digest('sha256', COALESCE(location, ''))` 的函数索引/查询，避免在无限长文本上直接建 B-tree 索引，同时避免 MD5 碰撞风险。
- **修复软删除问题**：`ImportError` 当前无 `deleted_at` 字段，批次删除时对 `ImportError` 执行硬删除（该数据为导入过程的临时错误记录，无需保留）。
- **修复并发竞态**：企业查找/创建使用 `SELECT FOR UPDATE` 行锁，并在 `Hazard` 表增加部分唯一索引 `(enterprise_id, digest('sha256', content), digest('sha256', COALESCE(location, ''))) WHERE deleted_at IS NULL`，从数据库层面兜底防止并发重复插入。
- **统一导入入口**：保留现有 `POST /api/v1/batches/import` 作为唯一导入接口，新增 `POST /api/v1/batches/preview` 用于后端解析预览（不写入数据库）。
- **增加文件暂存机制**：预览接口将上传的文件暂存到 MinIO（路径 `temp/batch-preview/{temp_token}/{filename}`），返回 `temp_token`；导入接口接收 `temp_token` 直接读取暂存文件执行导入，避免用户上传两次文件。
- **明确事务语义**：批次导入采用“逐行提交、部分成功”语义。单条记录失败仅回滚该条，不影响已成功的记录和批次元数据。`Batch` 的 `success_count` / `fail_count` 在全部行处理完毕后统一更新并提交。

## 需求摘要

扩展现有的隐患批量导入功能（`frontend/src/pages/Batch/BatchImport.tsx`、`backend/app/routers/batches.py`、`backend/app/services/import_service.py`），新增以下能力：

1. **导入前数据预览与校验**：用户上传 Excel/CSV 后，前端调用后端 `preview` 接口解析并展示前 20 条待导入数据及基础校验结果（空值提示）。
2. **支持更多文件格式**：后端导入服务兼容 `.xlsx`、`.xls`、`.csv`（含 UTF-8、GBK、GB2312 编码）。
3. **模板下载**：提供标准导入模板下载（Excel `.xlsx` 和 CSV `.csv` 两种格式），包含表头：企业名称、隐患描述、隐患位置。
4. **业务级重复检测**：导入时检测最近 1 个月内是否已存在相同（企业名称 + 隐患描述 + 位置）的隐患记录，若存在则标记为失败。
5. **导入历史记录**：在前端展示导入批次列表，包含批次名称、导入时间、导入人、成功/失败条数；支持下载失败明细、下载原始文件、删除批次。

## 验收标准

- [ ] 用户在前端上传文件后，可调出预览弹窗，展示前 20 条数据及总条数。
- [ ] 预览阶段能提示空值、格式错误等基础校验问题（如企业名称为空）。
- [ ] 后端能正确解析 `.xlsx`、`.xls`、`.csv` 文件。
- [ ] 模板下载接口返回包含正确表头的 `.xlsx` 和 `.csv` 文件。
- [ ] 导入时，最近 1 个月内已存在相同（企业 + 隐患描述 + 位置）的数据会被拒绝，并在失败明细中提示“重复数据（最近1个月内已存在）”。
- [ ] 导入历史页面展示所有批次，支持分页；可下载失败明细（Excel）、下载原始文件、删除批次。
- [ ] 删除批次时，关联的 `Hazard` 记录被软删除，关联的 `ImportError` 记录被硬删除，MinIO 上的原始文件和预览暂存文件被物理删除。
- [ ] 所有新增/修改的后端接口有对应的 pytest 测试覆盖。

## 实现步骤

### 步骤 1：数据库模型与索引调整

**文件：**
- `backend/app/models/import_error.py`
- `backend/app/models/batch.py`
- `backend/app/models/hazard.py`
- Alembic 迁移脚本

**操作：**
1. 在 `Batch` 模型中新增字段：
   ```python
   creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
   original_file_path = Column(String(500), nullable=True)
   ```
2. `ImportError` 模型保持不变（无 `deleted_at`），删除策略改为硬删除。
3. 在 `Hazard` 模型的 `__table_args__` 中新增部分唯一索引（使用 PostgreSQL 函数索引，采用 sha256 避免 MD5 碰撞风险）：
   ```python
   Index(
       "ix_hazards_enterprise_content_hash_location_hash",
       "enterprise_id",
       text("digest(content, 'sha256')"),
       text("digest(COALESCE(location, ''), 'sha256')"),
       unique=True,
       postgresql_where=text("deleted_at IS NULL"),
   ),
   ```
   > 注：`location` 可能为 NULL，使用 `COALESCE(location, '')` 保证一致性。
4. 生成并应用 Alembic 迁移脚本：
   ```bash
   cd backend && alembic revision --autogenerate -m "add batch creator and file path and hazard hash index"
   cd backend && alembic upgrade head
   ```

### 步骤 2：后端预览接口

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/services/import_service.py`
- `backend/app/schemas/batch.py`

**操作：**
1. 在 `batch.py` schema 中新增预览响应模型：
   ```python
   class BatchPreviewItem(BaseModel):
       row_index: int
       enterprise_name: str | None
       content: str | None
       location: str | None
       errors: list[str]

   class BatchPreviewResponse(BaseModel):
       total: int
       items: list[BatchPreviewItem]
   ```
2. 在 `ImportService` 中新增 `preview_file(filename: str, content: BinaryIO)` 方法：
   - 使用 pandas 读取文件（与 `import_file` 相同的读取逻辑）。
   - 遍历前 50 行（或全部），对每行执行列名归一化和基础校验（企业名、隐患描述是否为空）。
   - **不查询数据库、不写入数据库**，仅返回解析结果和校验错误。
3. 在 `batches.py` 中新增 `POST /api/v1/batches/preview` 路由：
   - 接收 `UploadFile` 和可选的 `batch_name` 参数。
   - 读取文件内容后，使用 `StorageService` 将文件暂存到 MinIO，路径为 `temp/batch-preview/{temp_token}/{filename}`（`temp_token` 使用 `uuid.uuid4()` 生成）。
   - 调用 `ImportService.preview_file` 生成预览数据。
   - 返回 `BatchPreviewResponse`，限制返回前 20 条，并携带 `temp_token`。
   - 前端确认导入时，将 `temp_token` 和 `batch_name` 一起发送到 `POST /api/v1/batches/import`。

### 步骤 3：后端导入接口增强（唯一入口）

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/services/import_service.py`
- `backend/app/services/storage_service.py`

**操作：**
1. 修改 `ImportService.import_file` 签名：
   ```python
   async def import_file(self, temp_token: str, filename: str, batch_name: str, user_id: UUID)
   ```
   - 通过 `temp_token` 从 MinIO 的 `temp/batch-preview/{temp_token}/{filename}` 路径读取暂存文件内容。
   - 写入 `creator_id = user_id`。
   - 批次创建后，将原始文件从暂存路径移动到 `uploads/batches/{batch.id}/{filename}`，并记录到 `original_file_path`。
   - 若导入过程中发生异常，确保清理暂存文件。
2. 在 `_process_row` 中增加并发安全的企业创建逻辑：
   - 查找企业时使用 `SELECT FOR UPDATE`：
     ```python
     result = await self.db.execute(
         select(Enterprise)
         .where(Enterprise.name == enterprise_name, Enterprise.deleted_at.is_(None))
         .with_for_update()
     )
     ```
   - 若不存在则创建并立即 `flush`，随后 `commit` 或 `flush` 以尽快释放 `SELECT FOR UPDATE` 行锁，避免锁持有跨批次的大循环。
3. 在 `_process_row` 中增加重复检测（结合数据库索引兜底），并显式捕获唯一索引冲突：
   ```python
   from datetime import datetime, timedelta
   from zoneinfo import ZoneInfo
   from sqlalchemy.exc import IntegrityError

   one_month_ago = datetime.now(ZoneInfo("Asia/Shanghai")) - timedelta(days=30)
   dup_result = await self.db.execute(
       select(Hazard).where(
           Hazard.enterprise_id == enterprise.id,
           Hazard.content == content,
           Hazard.location == location,
           Hazard.deleted_at.is_(None),
           Hazard.created_at >= one_month_ago,
       )
   )
   if dup_result.scalar_one_or_none():
       raise ValueError("重复数据（最近1个月内已存在）")
   ```
   - 在 `import_file` / `import_json` 的 Hazard `add` + `flush` 处包裹 `try/except IntegrityError`：
     ```python
     try:
         self.db.add(hazard)
         await self.db.flush()
     except IntegrityError:
         await self.db.rollback()
         raise ValueError("重复数据（最近1个月内已存在）")
     ```
   - 由于步骤 1 已建立部分唯一索引，极端并发下数据库会拒绝重复插入；应用层捕获 `IntegrityError` 后转换为友好的业务错误提示，避免返回 500。
4. 修改 `batches.py` 的 `POST /api/v1/batches/import`：
   - 接收 `temp_token` 和 `name`（批次名称）参数。
   - 从 `Depends(get_current_active_user)` 获取当前用户，传入 `user_id=current_user.id`。
   - 调用 `ImportService.import_file(temp_token, filename, name, user_id)` 执行导入。

### 步骤 4：模板下载功能

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/services/template_service.py`（新建）

**操作：**
1. 新建 `backend/app/services/template_service.py`：
   - `generate_excel_template()`：使用 `openpyxl` 创建包含表头的 `.xlsx`，返回 `io.BytesIO`。
   - `generate_csv_template()`：返回 UTF-8 BOM 的 CSV 字节流。
2. 在 `batches.py` 中新增 `GET /api/v1/batches/template?format=excel|csv`，返回 `StreamingResponse`。

### 步骤 5：导入历史记录页面

**文件：**
- `frontend/src/pages/Batch/BatchHistory.tsx`（新建）
- `frontend/src/api/batch.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout/index.tsx`

**操作：**
1. 在 `Layout.tsx` 菜单中新增 `{ key: '/batches/history', label: '导入历史' }`。
2. 在 `App.tsx` 中新增路由 `<Route path="batches/history" element={<BatchHistory />} />`。
3. 新建 `BatchHistory.tsx`：
   - 展示批次列表（Table + Pagination）。
   - 操作列：下载失败明细、下载原始文件、删除批次。
4. 在 `batch.ts` 中新增 API 函数：
   - `getBatches(params)`
   - `previewImport(formData)`
   - `downloadBatchFile(batchId)`
   - `deleteBatch(batchId)`
   - `downloadTemplate(format)`

### 步骤 6：后端历史记录与删除接口

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/schemas/batch.py`

**操作：**
1. 在 `BatchResponse` schema 中新增字段：
   ```python
   creator_username: Optional[str] = None
   original_file_path: Optional[str] = None
   ```
2. 修改 `GET /api/v1/batches`：
   - 返回分页列表，包含 `creator_username`（通过 join `User` 表）。
   - 按 `import_time` 倒序排列。
3. 新增 `GET /api/v1/batches/{batch_id}/download`：
   - 从 MinIO 读取 `original_file_path`，返回 `StreamingResponse`。
4. 新增 `DELETE /api/v1/batches/{batch_id}`：
   - 查询批次，软删除：
     ```python
     batch.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
     ```
   - 软删除关联的 `Hazard`：
     ```python
     await db.execute(
         update(Hazard)
         .where(Hazard.batch_id == batch_id, Hazard.deleted_at.is_(None))
         .values(deleted_at=datetime.now(ZoneInfo("Asia/Shanghai")))
     )
     ```
   - 硬删除关联的 `ImportError`：
     ```python
     await db.execute(
         delete(ImportError).where(ImportError.batch_id == batch_id)
     )
     ```
   - 删除 MinIO 原始文件和可能的预览暂存文件：
     ```python
     storage = StorageService()
     if batch.original_file_path:
         object_name = batch.original_file_path.lstrip("/")
         if object_name.startswith(storage.bucket + "/"):
             object_name = object_name[len(storage.bucket) + 1:]
         storage.client.remove_object(storage.bucket, object_name)
     ```
   - 在 `StorageService` 中新增 `delete_file(path: str)` 方法（包装 `remove_object`，处理路径前缀）。

### 步骤 7：前端批量导入页面改造

**文件：**
- `frontend/src/pages/Batch/BatchImport.tsx`

**操作：**
1. 保留文件选择上传组件。
2. 用户选择文件后，点击“预览”按钮，调用 `previewImport` 接口。
3. 弹窗展示预览表格（最多 20 条），标红显示校验错误行。
4. 用户确认无误后，点击“确认导入”，调用 `importHazards({ temp_token, name })` 传入 `temp_token` 和批次名称，由后端从 MinIO 暂存区读取文件执行导入。
5. 导入成功后跳转至 `/batches/history` 或展示结果卡片。

### 步骤 8：测试

**文件：**
- `backend/tests/test_batches.py`（新建）

**操作：**
1. 测试 `POST /api/v1/batches/preview`：正常解析、空值校验提示、返回 `temp_token`。
2. 测试 `POST /api/v1/batches/import`：使用 `temp_token` 正常导入、重复数据检测（含并发模拟）、`IntegrityError` 被正确转换为友好错误提示。
3. 测试 `GET /api/v1/batches/template?format=excel` 和 `format=csv`：返回正确 Content-Type。
4. 测试 `GET /api/v1/batches`：分页和 creator 信息正确。
5. 测试 `DELETE /api/v1/batches/{id}`：批次软删除、Hazard 软删除、ImportError 硬删除、MinIO 原始文件和暂存文件被清理。

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 预览接口后端负载高 | 预览接口仅做内存解析，不查询/写入数据库；限制返回前 20 条；设置文件大小上限（如 10MB）。 |
| 并发导入重复数据 | 企业查找使用 `SELECT FOR UPDATE` + `Hazard` 部分唯一索引兜底。 |
| 长文本索引失败 | 使用 `digest(content, 'sha256')` 函数索引，避免 B-tree 长度限制和 MD5 碰撞风险。 |
| MinIO 文件泄漏 | 删除批次时同步调用 `StorageService.delete_file` 清理原始文件。 |
| 前后端校验不一致 | 解析逻辑完全由后端 `ImportService` 统一处理，前端仅展示结果。 |

## 验证步骤

1. 启动前后端，进入“批量导入”页面，上传 `.xlsx` 文件，点击“预览”，确认弹窗展示前 20 条数据及校验提示。
2. 上传包含空企业名称的文件，确认预览表格中对应行标红并显示错误信息。
3. 点击模板下载，分别下载 `.xlsx` 和 `.csv`，确认文件内容正确。
4. 导入一条数据后，再次导入相同数据，确认提示“重复数据（最近1个月内已存在）”。
5. 进入“导入历史”页面，确认列表展示正确；点击下载失败明细和原始文件，确认可正常下载；点击删除，确认批次及关联隐患被软删除、ImportError 被清理、MinIO 文件被删除。
6. 运行 `cd backend && pytest tests/test_batches.py`，确认全部通过。

## RALPLAN-DR Summary

### Principles
1. **单一真相源**：所有解析和校验逻辑集中在后端 `ImportService`，前端仅做展示，杜绝前后端逻辑分叉。
2. **渐进替换而非并行**：保留现有 `/import` 入口，新增 `/preview` 辅助接口，不引入并行的 JSON 导入路径。
3. **数据库兜底**：通过 `SELECT FOR UPDATE` 和部分唯一索引，从数据库层保证并发安全。
4. **审计与清理并重**：原始文件随批次记录保留以供审计，删除批次时同步清理物理文件，避免存储泄漏。
5. **务实取舍**：`ImportError` 作为临时过程数据，采用硬删除策略，简化实现且不影响业务审计。

### Decision Drivers
1. 数据一致性：避免前端解析与后端解析结果不一致导致用户困惑。
2. 可维护性：不维护两套导入路径，降低长期技术债务。
3. 并发安全：在业务重复检测场景下，数据库级约束比应用层判断更可靠。

### Viable Options

#### Option A：后端统一解析（预览 + 导入）【推荐】
- **Approach**：前端上传文件到后端 `/preview` 获取解析结果，确认后再上传同一文件到 `/import` 执行导入。
- **Pros**：单一真相源、编码和校验逻辑无分叉、后端技术栈成熟（pandas 已就位）。
- **Cons**：预览阶段产生一次后端 IO 和内存解析开销；网络传输文件两次。

#### Option B：前端本地解析预览 + 后端 JSON 导入【v1 方案，已否决】
- **Approach**：前端用 SheetJS 解析文件展示预览，确认后将数据以 JSON 数组形式发送到后端导入。
- **Pros**：预览响应快、不占用后端资源。
- **Cons**：前后端解析逻辑必然分叉（编码处理、空值判断、列名归一化）；大文件导致浏览器内存压力；需要维护两套导入路径。

**Invalidation rationale for Option B**：
在业务场景中，CSV 编码 fallback（UTF-8 → GBK → GB2312）和列名归一化逻辑复杂，前端难以完全复刻后端行为；维护两套路径的长期成本远高于预览时多一次文件上传的短期开销。

## ADR

### Decision
采用后端统一解析方案：新增 `POST /api/v1/batches/preview` 用于导入前预览，`POST /api/v1/batches/import` 作为唯一导入入口；重复检测通过应用层查询 + 数据库部分唯一索引共同保障；删除批次时执行关联数据的级联清理。

### Drivers
- 需要导入前预览以减少因格式错误导致的导入失败。
- 需要防止重复隐患数据在短期（1 个月）内被重复导入。
- 需要可追溯的导入历史记录和原始文件管理。
- 需要避免前后端解析逻辑分叉带来的维护负担。

### Alternatives considered
- 前端本地解析 + JSON 导入（因解析逻辑分叉和双路径维护问题被否决）。
- 文件级 MD5 重复检测（无法防止内容微调的重复数据，被否决）。
- 永久业务级重复检测（过于严格，不允许历史隐患的周期性更新，被否决）。

### Why chosen
后端统一解析保证了数据一致性；`/preview` 接口轻量（仅内存解析，不操作数据库），对后端负载影响可控；数据库部分唯一索引为并发场景提供了最终保障；历史记录和文件清理策略兼顾了审计需求和存储管理。

### Consequences
- 用户预览时上传文件到 MinIO 暂存区，确认导入时通过 `temp_token` 复用同一文件，无需二次上传。
- `Batch` 模型需扩展字段并执行数据库迁移。
- `StorageService` 需新增文件删除和暂存读取能力。
- `ImportError` 采用硬删除，需在删除服务中显式处理。

### Follow-ups
- 若预览接口负载成为瓶颈，可引入 Redis 缓存预览结果（key = 文件内容 sha256 + 文件名）。
- 评估是否需要限制上传文件大小（如 10MB）以控制解析内存占用。
- 考虑为导入历史页面增加按时间范围和导入人筛选的功能。
- **定期清理 MinIO 中过期的 `temp/batch-preview/` 暂存文件**：建议配置 Celery 定时任务（如每天一次），删除超过 24 小时的预览暂存对象，防止用户放弃预览后产生存储泄漏。
