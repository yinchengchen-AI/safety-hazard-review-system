# 完善和扩展批量导入功能模块

## 需求摘要

扩展现有的隐患批量导入功能（`frontend/src/pages/Batch/BatchImport.tsx`、`backend/app/routers/batches.py`、`backend/app/services/import_service.py`），新增以下能力：

1. **前端本地解析预览**：用户上传 Excel/CSV 后，前端使用 SheetJS 解析并展示待导入数据，支持分页查看和基本校验提示。
2. **支持更多文件格式**：后端导入服务兼容 `.xlsx`、`.xls`、`.csv`（含 UTF-8、GBK、GB2312 编码）。
3. **模板下载**：提供标准导入模板下载（Excel `.xlsx` 和 CSV `.csv` 两种格式），包含表头：企业名称、隐患描述、隐患位置。
4. **业务级重复检测**：导入时检测最近 1 个月内是否已存在相同（企业名称 + 隐患描述 + 位置）的隐患记录，若存在则标记为失败。
5. **导入历史记录**：在前端展示导入批次列表，包含批次名称、导入时间、导入人、成功/失败条数；支持下载失败明细、下载原始文件、删除批次。

## 验收标准

- [ ] 用户在前端上传文件后，可在确认前预览前 20 条数据及总条数。
- [ ] 预览阶段能提示空值、格式错误等基础校验问题（如企业名称为空）。
- [ ] 后端能正确解析 `.xlsx`、`.xls`、`.csv` 文件。
- [ ] 模板下载接口返回包含正确表头的 `.xlsx` 和 `.csv` 文件。
- [ ] 导入时，最近 1 个月内已存在相同（企业 + 隐患描述 + 位置）的数据会被拒绝，并在失败明细中提示“重复数据”。
- [ ] 导入历史页面展示所有批次，支持分页；可下载失败明细（JSON/Excel）、下载原始文件、删除批次（软删除）。
- [ ] 删除批次时，关联的隐患数据和导入错误记录一并被软删除。
- [ ] 所有新增/修改的后端接口有对应的 pytest 测试覆盖。

## 实现步骤

### 步骤 1：前端依赖与本地解析预览

**文件：**
- `frontend/package.json`
- `frontend/src/pages/Batch/BatchImport.tsx`
- `frontend/src/api/batch.ts`

**操作：**
1. 安装 `xlsx`（SheetJS）到前端依赖：`cd frontend && npm install xlsx`。
2. 在 `BatchImport.tsx` 中引入 `xlsx`，使用 `FileReader` 读取上传文件。
3. 解析后展示预览表格（最多 20 条），列名为：企业名称、隐患描述、隐患位置。
4. 基础校验：检查企业名称和隐患描述是否为空，空值行标红提示。
5. 用户点击“确认导入”后，将解析后的数据以 JSON 数组形式通过 `POST /api/v1/batches/import-json` 发送到后端。

### 步骤 2：后端新增 JSON 导入接口与格式兼容

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/services/import_service.py`
- `backend/app/schemas/batch.py`

**操作：**
1. 在 `batch.py` schema 中新增 `BatchImportJsonRequest`：
   ```python
   class HazardImportItem(BaseModel):
       enterprise_name: str
       content: str
       location: Optional[str] = None

   class BatchImportJsonRequest(BaseModel):
       batch_name: str
       items: list[HazardImportItem]
   ```
2. 在 `batches.py` 中新增 `POST /api/v1/batches/import-json` 路由，接收 `BatchImportJsonRequest`，调用 `ImportService.import_json`。
3. 修改 `ImportService`：
   - 新增 `import_json` 方法，遍历 `items` 列表。
   - 每条记录处理逻辑与现有 `_process_row` 一致：查找/创建企业、业务级重复检测、创建 Hazard。
   - 保留现有的 `import_file` 方法以兼容旧上传入口（可选标记为 deprecated）。
4. 在 `import_file` 中扩展 `.xls` 支持（`pd.read_excel` 已兼容，无需额外改动）。

### 步骤 3：业务级重复检测

**文件：**
- `backend/app/services/import_service.py`
- `backend/app/models/hazard.py`

**操作：**
1. 在 `_process_row` 和 `import_json` 的每条记录处理中，查找/创建企业后，增加重复检测查询：
   ```python
   from datetime import datetime, timedelta
   from zoneinfo import ZoneInfo

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
2. 确保 `Hazard.created_at` 已建立索引（检查 `ix_hazards_enterprise_status_created` 是否包含 `created_at`；若查询性能不足，可新增 `ix_hazards_enterprise_content_location_created`）。

### 步骤 4：模板下载功能

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/services/template_service.py`（新建）

**操作：**
1. 新建 `backend/app/services/template_service.py`，提供生成模板的方法：
   - `generate_excel_template()`：使用 `openpyxl` 创建包含表头（企业名称、隐患描述、隐患位置）的 `.xlsx` 文件，返回 `io.BytesIO`。
   - `generate_csv_template()`：返回包含 UTF-8 BOM 的 CSV 字节流，便于 Excel 正确打开中文。
2. 在 `batches.py` 中新增 `GET /api/v1/batches/template` 路由，支持 `?format=excel|csv`，返回 `StreamingResponse` 并设置正确的 `Content-Disposition` 和 `Content-Type`。

### 步骤 5：导入历史记录页面

**文件：**
- `frontend/src/pages/Batch/BatchHistory.tsx`（新建）
- `frontend/src/api/batch.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout/index.tsx`

**操作：**
1. 在 `Layout.tsx` 的 `menuItems` 中新增 `{ key: '/batches/history', label: '导入历史' }`。
2. 在 `App.tsx` 中新增路由 `<Route path="batches/history" element={<BatchHistory />} />`。
3. 新建 `BatchHistory.tsx`，展示批次列表（Table + Pagination），列：批次名称、导入时间、导入人、成功数、失败数、操作。
4. 操作列包含：
   - 下载失败明细（调用 `GET /api/v1/batches/{batch_id}/errors`，前端生成 Excel 下载）。
   - 下载原始文件（调用 `GET /api/v1/batches/{batch_id}/download`）。
   - 删除批次（调用 `DELETE /api/v1/batches/{batch_id}`，成功后刷新列表）。
5. 在 `batch.ts` API 中新增对应请求函数。

### 步骤 6：后端历史记录与文件存储接口

**文件：**
- `backend/app/routers/batches.py`
- `backend/app/models/batch.py`
- `backend/app/schemas/batch.py`
- `backend/app/services/import_service.py`

**操作：**
1. 在 `Batch` 模型中新增字段：
   - `creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)`
   - `original_file_path = Column(String(500), nullable=True)`
2. 生成 Alembic 迁移脚本并应用升级。
3. 修改 `import_file`：上传文件时，使用 `StorageService` 将原始文件保存到 MinIO（路径如 `uploads/batches/{batch_id}/{filename}`），记录 `original_file_path`。
4. 修改 `import_file` 签名，接收 `user_id` 参数并写入 `creator_id`。
5. 在 `batches.py` 中新增/修改路由：
   - `GET /api/v1/batches`：返回批次列表（含 creator 信息），按 `import_time` 倒序，支持分页参数 `page`/`page_size`。
   - `GET /api/v1/batches/{batch_id}/download`：返回原始文件流（从 MinIO 读取）。
   - `DELETE /api/v1/batches/{batch_id}`：软删除批次，同时将其关联的 `Hazard` 记录和 `ImportError` 记录软删除。
6. 在 `BatchResponse` schema 中新增 `creator_username` 和 `original_file_path`。

### 步骤 7：测试

**文件：**
- `backend/tests/test_batches.py`（新建）

**操作：**
1. 测试 `POST /api/v1/batches/import-json`：正常导入、重复数据检测。
2. 测试 `GET /api/v1/batches/template?format=excel` 和 `format=csv`：返回 200 及正确 Content-Type。
3. 测试 `GET /api/v1/batches`：列表包含正确分页和 creator 信息。
4. 测试 `DELETE /api/v1/batches/{id}`：删除后批次及关联隐患均被软删除。

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 前端 `xlsx` 包体积过大 | 使用 `xlsx` 的轻量版本或按需导入；若体积不可接受，可改用 `papaparse`（仅 CSV）+ `exceljs`（仅 Excel）。 |
| 大文件预览卡顿 | 前端仅解析并展示前 20 条，完整数据在确认导入后才完整处理。 |
| MinIO 文件泄漏 | 删除批次时，同步调用 `StorageService` 删除 MinIO 上的原始文件。 |
| 重复检测性能差 | 为 `hazards` 表的 `(enterprise_id, content, location, created_at)` 建立组合索引。 |
| 并发导入导致重复 | 对企业查找/创建使用数据库唯一约束或行锁（`SELECT FOR UPDATE`）。 |

## 验证步骤

1. 启动前后端，进入“批量导入”页面，上传 `.xlsx` 文件，确认能预览前 20 条数据。
2. 故意上传包含空企业名称的文件，确认预览表格中对应行标红。
3. 点击模板下载，分别下载 `.xlsx` 和 `.csv`，确认文件内容正确。
4. 导入一条数据后，再次导入相同数据，确认提示“重复数据（最近1个月内已存在）”。
5. 进入“导入历史”页面，确认列表展示正确；点击下载失败明细和原始文件，确认可正常下载；点击删除，确认批次及关联隐患被软删除。
6. 运行 `cd backend && pytest tests/test_batches.py`，确认全部通过。

## RALPLAN-DR Summary

### Principles
1. **渐进增强**：保留现有上传入口，新增 JSON 导入接口，降低对现有流程的破坏风险。
2. **前端减负**：预览逻辑放在前端本地解析，避免后端在预览阶段承担解析和校验压力。
3. **业务优先**：重复检测以业务数据（企业+隐患+位置）为准，而非文件级哈希，真正防止重复隐患入库。
4. **可追溯性**：所有导入批次记录原始文件和导入人，支持历史回溯和审计。
5. **软删除一致性**：批次删除时，关联的业务数据和错误记录统一软删除，避免数据孤岛。

### Decision Drivers
1. 用户体验：导入前能预览和校验，减少因格式错误导致的大规模导入失败。
2. 数据质量：通过业务级重复检测和模板规范，降低脏数据和重复数据进入系统的概率。
3. 系统可维护性：历史记录和原始文件存储使导入过程可追溯，便于问题排查。

### Viable Options

#### Option A：前端本地解析 + 后端 JSON 导入（推荐）
- **Pros**：预览响应快、不占用后端资源、接口简洁、易于测试。
- **Cons**：前端包体积略有增加、大文件仍需完整读取到内存。

#### Option B：后端解析后返回预览数据
- **Pros**：前端逻辑简单、包体积小。
- **Cons**：每次预览都产生后端 IO 和 DB 查询压力、网络延迟高、用户体验差。

**Invalidation rationale for Option B**：批量导入场景中，用户可能频繁更换文件进行预览，后端解析会产生不必要的资源消耗；前端本地解析更符合“预览”场景的轻量需求。

## ADR

### Decision
采用前端本地解析（SheetJS）+ 后端 JSON 批量导入的方案实现数据预览和导入；重复检测基于业务字段（企业+隐患描述+位置）在最近 1 个月内查询；历史记录页面支持下载失败明细、原始文件和删除批次。

### Drivers
- 用户需要在导入前确认数据正确性。
- 需要防止重复隐患数据在短期（1 个月）内被重复导入。
- 运营和审计需要追溯每次导入的原始文件和结果。

### Alternatives considered
- 后端解析预览（因后端负载问题被否决）。
- 文件级 MD5 重复检测（无法防止内容微调的重复数据，被否决）。
- 永久业务级重复检测（过于严格，不允许历史隐患的周期性更新，被否决）。

### Why chosen
前端本地解析兼顾了用户体验和系统性能；JSON 导入接口通用且易于扩展；1 个月业务级重复检测在数据质量和灵活性之间取得平衡；历史记录功能满足运营审计需求。

### Consequences
- 前端需新增 `xlsx` 依赖。
- 后端 `Batch` 模型需扩展字段并执行数据库迁移。
- MinIO 存储空间会随原始文件上传而增长，需在删除批次时同步清理。

### Follow-ups
- 监控 `xlsx` 包体积，必要时替换为更轻量的解析库。
- 评估是否需要为 `hazards` 表新增 `(enterprise_id, content, location, created_at)` 索引。
- 考虑为导入历史页面增加筛选和搜索功能。
