# 完善和优化创建隐患复核任务和隐患复核流程

## 需求摘要

优化隐患复核任务的全流程用户体验，覆盖任务创建、任务调整、批量复核、复核编辑、照片管理和完成校验等环节。

## 验收标准

- [ ] 隐患列表支持按企业名称、批次、状态搜索筛选，支持分页
- [ ] 创建任务前展示选中隐患的汇总信息（涉及企业数、隐患数、批次分布）
- [ ] 任务详情页支持将未复核的隐患从任务中移除，移除后该隐患恢复可被选状态
- [ ] 任务详情页支持批量复核（同企业内多选隐患后统一填写结论和状态）
- [ ] 已复核的隐患支持编辑修改结论和状态，修改后记录历史并更新父隐患状态
- [ ] 复核弹窗中的照片支持预览和删除
- [ ] 完成任务时后端校验所有隐患均已复核，否则返回友好提示
- [ ] 所有新增/修改的后端接口有对应的 pytest 测试覆盖

## 实现步骤

### 步骤 1：隐患列表筛选与分页

**文件：**
- `backend/app/routers/hazards.py`
- `backend/app/services/hazard_service.py`（如不存在则新建）
- `frontend/src/pages/Hazard/HazardList.tsx`
- `frontend/src/api/hazard.ts`

**操作：**
1. 修改 `GET /api/v1/hazards`：
   - 新增查询参数：`enterprise_name`（模糊匹配）、`batch_id`（精确匹配）、`status`（精确匹配）、`page`、`page_size`
   - 使用 SQLAlchemy 动态构建 `where` 条件
   - 返回分页结构 `{"items": [...], "total": N}`
2. 前端 `HazardList`：
   - 在 Collapse 上方增加筛选栏：企业名称输入框、批次下拉选择（调用 `getBatches`）、状态下拉选择（pending/passed/failed）、查询/重置按钮
   - 将 `getHazards` 改为支持分页参数，底部增加 `Pagination`
   - 筛选条件变化时重置到第 1 页

### 步骤 2：创建任务前汇总确认

**文件：**
- `frontend/src/pages/Hazard/HazardList.tsx`

**操作：**
1. 点击"创建复核任务"按钮后，弹窗除了任务名称输入框外，增加汇总信息卡片：
   - 选中隐患总数
   - 涉及企业数
   - 批次分布列表（如：batchA: 5条, batchB: 3条）
2. 用户确认无误后点击"确认创建"，再调用 `createTask`

### 步骤 3：任务详情页支持移除隐患

**文件：**
- `backend/app/routers/review_tasks.py`
- `frontend/src/pages/Task/TaskDetail.tsx`
- `frontend/src/api/task.ts`

**操作：**
1. 后端新增 `DELETE /api/v1/review-tasks/{task_id}/hazards/{hazard_id}`：
   - 仅允许任务状态为 `pending` 时调用
   - 删除对应的 `TaskHazard` 记录
   - 将该 `Hazard.current_task_id` 设为 `None`
   - 如果该隐患已被复核，同步回退 `Hazard.status` 为 `pending` 并递减 `review_count`（如需要）
   - 更新 `ReviewTask` 的 `hazard_count` 逻辑由查询实时计算，无需手动维护
2. 前端 `TaskDetail`：
   - 在每个未复核隐患的 List.Item actions 中增加"移除"按钮（Popconfirm 确认）
   - 调用 `removeHazardFromTask(taskId, hazardId)` 后刷新任务详情

### 步骤 4：批量复核

**文件：**
- `backend/app/routers/review_tasks.py`
- `backend/app/schemas/review_task.py`
- `frontend/src/pages/Task/TaskDetail.tsx`
- `frontend/src/api/task.ts`

**操作：**
1. 后端新增 `POST /api/v1/review-tasks/{task_id}/batch-review`：
   - 请求体：`{ hazard_ids: UUID[], conclusion: str, status_in_task: str, photo_tokens: str[] }`
   - 遍历 `hazard_ids`，对每条隐患执行与单条复核相同的逻辑（更新 TaskHazard、Hazard 状态、历史记录、照片绑定）
   - 使用事务包裹，任意一条失败则整体回滚
2. 前端 `TaskDetail`：
   - 在每个企业的 Collapse 面板内的 Table/List 上增加行选择功能
   - 当用户选中一个或多个未复核隐患后，面板标题或底部出现"批量复核"按钮
   - 点击后弹出与单条复核相同的表单弹窗，提交后调用 `batchReviewHazard`

### 步骤 5：复核编辑与历史记录

**文件：**
- `backend/app/routers/review_tasks.py`
- `backend/app/models/hazard_status_history.py`
- `frontend/src/pages/Task/TaskDetail.tsx`

**操作：**
1. 后端修改 `POST /api/v1/review-tasks/{task_id}/hazards/{hazard_id}/review`：
   - 不再限制只能复核一次，允许对已复核的 `TaskHazard` 再次提交
   - 记录旧值（`old_conclusion`、`old_status_in_task`）
   - 更新 `TaskHazard` 和 `Hazard` 状态
   - 新增 `HazardStatusHistory` 记录，reason 格式为 `"Reviewed in task {task_id} (edited)"`
2. 前端 `TaskDetail`：
   - 已复核隐患的 actions 从只读 Tag 改为显示"编辑"按钮
   - 点击"编辑"打开复核弹窗，表单预填充当前结论和状态
   - 照片 tokens 回显逻辑：由于已上传照片没有 temp_token，编辑时只支持追加新照片，不处理旧照片删除（照片删除单独在步骤 6 处理）

### 步骤 6：照片预览与删除

**文件：**
- `backend/app/routers/review_tasks.py`
- `frontend/src/pages/Task/TaskDetail.tsx`

**操作：**
1. 后端新增 `DELETE /api/v1/photos/{photo_id}`（如不存在）：
   - 软删除或硬删除照片记录，同时删除 MinIO 文件
2. 前端复核弹窗：
   - `photoTokens` 状态改为 `uploadedPhotos` 数组，结构 `{ temp_token?: string, url?: string, id?: string }`
   - 新上传的照片以 `temp_token` 形式加入
   - 编辑已有复核时，后端返回的 `photos` 以 `{ id, url }` 形式加入
   - 每张照片显示缩略图和删除按钮
   - 提交时过滤出所有 `temp_token` 传给后端

### 步骤 7：完成任务校验

**文件：**
- `backend/app/routers/review_tasks.py`
- `frontend/src/pages/Task/TaskList.tsx`

**操作：**
1. 后端 `complete_task`：
   - 在更新任务状态前，查询该任务下 `status_in_task IS NULL` 的 `TaskHazard` 数量
   - 若大于 0，返回 400，detail 为 "存在未复核的隐患，无法完成任务"
2. 前端 `TaskList`：
   - 调用 `completeTask` 捕获 400 错误，展示具体提示信息

### 步骤 8：测试

**文件：**
- `backend/tests/test_review_tasks.py`（新建或扩展）

**操作：**
1. 测试隐患列表分页和筛选
2. 测试从任务中移除隐患（验证 `current_task_id` 被清空）
3. 测试批量复核（多隐患同时更新状态和历史记录）
4. 测试复核编辑（二次提交更新历史记录）
5. 测试完成任务校验（有未复核隐患时返回 400）
6. 测试照片上传和删除

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 批量复核事务过大导致锁超时 | 批量复核接口限制单次最多 50 条隐患，超出时分批调用 |
| 移除已复核隐患后状态回退引发数据不一致 | 移除时显式将 Hazard.status 回退为 pending，并记录历史 |
| 编辑复核时照片状态混乱 | 区分 temp_token（新上传）和 photo_id（已有），只提交 temp_token |
| 前端分页后跨页选择丢失 | 使用 Table rowSelection 的 preserveSelectedRowKeys 属性保留跨页选择 |

## 验证步骤

1. 在隐患列表页使用筛选条件查询，确认分页和结果正确。
2. 选择多家企业隐患后点击创建任务，确认弹窗显示汇总信息。
3. 进入任务详情，移除一条未复核隐患，返回隐患列表确认该隐患可再次被选中。
4. 在任务详情中选中同企业多条隐患，点击批量复核，确认所有选中隐患状态同步更新。
5. 对一条已复核隐患点击编辑，修改结论和状态，确认历史记录新增一条 edited 记录。
6. 在复核弹窗中上传照片后删除其中一张，确认提交时只保留未删除的照片。
7. 尝试完成一个含有未复核隐患的任务，确认后端返回 400 并展示友好提示。
8. 运行 `cd backend && pytest tests/test_review_tasks.py`，确认全部通过。

## RALPLAN-DR Summary

### Principles
1. **渐进增强**：保留现有单条复核流程，在其基础上增加批量复核、编辑、移除等能力，不破坏已有行为。
2. **数据一致性优先**：任何状态变更（移除、编辑）都同步更新 Hazard 状态和审计历史。
3. **防御性后端**：批量操作和任务完成等关键节点由后端做最终校验，不依赖前端约束。
4. **用户体验闭环**：从筛选、选择、确认、复核到完成，每个环节都有明确的反馈和撤销能力。

### Decision Drivers
1. 复核人员需要高效处理大量隐患，批量复核和筛选是核心效率提升点。
2. 任务创建后可能发现选错隐患，支持移除可减少任务重建成本。
3. 复核结论可能因现场情况变化需要修正，编辑能力保证数据准确性。

### Viable Options

#### Option A：全量重构复核数据模型【否决】
- 引入独立的 ReviewRecord 表，每次复核生成新记录，TaskHazard 只保存最新 review_id。
- 优点：历史版本完整，支持多轮复核。
- 缺点：改动范围大，需要迁移数据，与现有代码兼容性差。

#### Option B：在现有模型上增量扩展【推荐】
- 保留 `TaskHazard` 作为复核结果载体，通过更新字段 + `HazardStatusHistory` 记录变更历史。
- 优点：改动小，兼容现有数据，实现快。
- 缺点：TaskHazard 本身不保存复核版本，历史需通过 HazardStatusHistory 间接查询。

**Invalidation rationale for Option A**：
当前系统只需要支持复核结论的编辑修正，不需要完整的多轮复核版本管理。Option A 的模型重构收益不足以抵消其迁移和兼容性成本。

## ADR

### Decision
采用 Option B 的增量扩展方案：在现有 `TaskHazard` 和 `HazardStatusHistory` 模型上直接增加批量复核、复核编辑、隐患移除和完成校验能力。

### Drivers
- 需要在短期内交付可用的效率优化功能。
- 现有数据模型已能满足编辑和审计需求，无需引入额外复杂度。
- 保持与现有 API 和前端代码的向后兼容。

### Alternatives considered
- 全量重构复核数据模型（因成本和兼容性被否决）。
- 前端纯展示优化而不改后端（无法满足编辑、移除、校验等核心需求被否决）。

### Why chosen
增量扩展方案以最小的模型改动覆盖了所有业务需求，同时保留了现有代码结构和数据兼容性。

### Consequences
- `TaskHazard` 的复核接口从"一次性写入"变为"可多次更新"。
- `HazardStatusHistory` 需要区分首次复核和编辑复核的 reason 文本。
- 前端复核弹窗需要同时支持"新建复核"和"编辑复核"两种模式。
- 任务完成接口增加未复核隐患校验。

### Follow-ups
- 评估是否需要为 TaskHazard 增加 `edited_at` 和 `edit_count` 字段以优化编辑追踪。
- 考虑为批量复核引入异步队列，处理超大批次的性能问题。
