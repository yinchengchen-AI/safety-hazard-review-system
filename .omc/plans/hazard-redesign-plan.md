# 隐患管理模块重新设计计划

## 需求总结

根据 Excel 文件《2026年3月重大事故隐患排查及整改情况明细表》重新设计隐患管理模块。

### Excel 字段映射

| Excel 字段 | 映射目标 | 说明 |
|-----------|---------|------|
| 审核状态 | **忽略** | 导入时的原始状态，与复核流程无关 |
| 上报单位 | `batches.reporting_unit` | 排查任务的上报机构（街道/区域） |
| 行业领域 | `enterprises.industry_sector` | 企业固有属性 |
| 企业类型 | `enterprises.enterprise_type` | 企业固有属性 |
| 企业名称 | `enterprises.name` | 已有字段 |
| 隐患分类 | `hazards.category` | 新增 |
| 重大隐患描述（举报问题描述） | `hazards.description` | 新增，替代现有 `content` |
| 检查方式 | `hazards.inspection_method` | 新增 |
| 检查人 | `hazards.inspector` | 新增 |
| 检查时间 | `hazards.inspection_date` | 新增 |
| 判定依据 | `hazards.judgment_basis` | 新增 |
| 违反判定依据具体条款 | `hazards.violation_clause` | 新增 |
| 是否整改 | `hazards.is_rectified` | 新增（布尔/字符串） |
| 实际整改完成时间 | `hazards.rectification_date` | 新增 |
| 整改责任部门/责任人 | `hazards.rectification_responsible` | 新增 |
| 整改措施 | `hazards.rectification_measures` | 新增 |
| 举报情况备注 | `hazards.report_remarks` | 新增 |

### 现有字段处理

- `hazards.content` → 迁移到 `hazards.description`，保留历史数据
- `hazards.location` → 保留，继续可用

---

## 验收标准

1. 数据库模型更新后，Alembic 迁移脚本可正常生成并执行
2. 现有历史数据不丢失（`content` 迁移到 `description`）
3. 后端 API 支持新增字段的 CRUD 和列表筛选
4. 前端隐患列表页展示所有新增字段（列宽可滚动或折叠）
5. Excel 导入模板支持新字段，导入校验通过
6. 复核任务流程不受改造影响，继续正常工作

---

## 实施步骤

### Step 1: 数据库模型扩展

**文件：**
- `backend/app/models/enterprise.py`
- `backend/app/models/hazard.py`
- `backend/app/models/batch.py`

**变更：**
1. `Enterprise` 模型新增 `industry_sector` (String 100)、`enterprise_type` (String 50)
2. `Batch` 模型新增 `reporting_unit` (String 100)
3. `Hazard` 模型新增以下字段：
   - `category` (String 50)
   - `description` (Text) — 用于替代 `content`
   - `inspection_method` (String 50)
   - `inspector` (String 100)
   - `inspection_date` (Date)
   - `judgment_basis` (String 500)
   - `violation_clause` (Text)
   - `is_rectified` (String 20，如 "是"/"否"/"部分整改"，或 Boolean)
   - `rectification_date` (Date)
   - `rectification_responsible` (String 200)
   - `rectification_measures` (Text)
   - `report_remarks` (Text)
4. 保留 `content` 和 `location`，在迁移脚本中将 `content` 数据复制到 `description`

### Step 2: Pydantic Schema 更新

**文件：**
- `backend/app/schemas/enterprise.py`
- `backend/app/schemas/hazard.py`
- `backend/app/schemas/batch.py`

**变更：**
1. `EnterpriseCreate` / `EnterpriseResponse` 增加 `industry_sector`、`enterprise_type`
2. `BatchResponse` 增加 `reporting_unit`
3. `HazardCreate` 增加所有新增字段，`description` 必填
4. `HazardResponse` 增加所有新增字段，以及 `reporting_unit`（通过 batch 关联）
5. `HazardListParams` 增加按 `category`、`is_rectified`、`inspection_method` 筛选的参数

### Step 3: 后端 API 更新

**文件：**
- `backend/app/routers/hazards.py`
- `backend/app/routers/batches.py`
- `backend/app/routers/enterprises.py`

**变更：**
1. `hazards.py` 的 `list_hazards` 和 `get_hazard` 返回新增字段
2. `list_hazards` 增加按 `category`、`is_rectified`、`inspection_method` 的筛选逻辑
3. `batches.py` 的导入接口接收并写入 `reporting_unit`
4. `enterprises.py` 的创建/更新接口支持 `industry_sector`、`enterprise_type`

### Step 4: 导入服务更新

**文件：**
- `backend/app/services/import_service.py`（或实际负责导入的服务文件）

**变更：**
1. 读取 Excel 时映射新字段
2. 企业查找/创建时写入 `industry_sector`、`enterprise_type`
3. 隐患创建时写入所有新增字段
4. 批次创建时写入 `reporting_unit`
5. 导入模板 `test_template.xlsx` 更新为新字段格式

### Step 5: 前端页面更新

**文件：**
- `frontend/src/pages/Hazard/HazardList.tsx`
- `frontend/src/api/hazard.ts`
- `frontend/src/api/enterprise.ts`
- `frontend/src/api/batch.ts`

**变更：**
1. `HazardList.tsx` 的表格列增加：隐患分类、检查方式、检查人、检查时间、判定依据、是否整改、整改完成时间、整改责任人、整改措施
2. 列较多时采用固定左侧企业名称 + 横向滚动，或折叠展示
3. 列表筛选区增加：隐患分类、是否整改、检查方式
4. API 类型定义同步更新

### Step 6: 数据迁移

**文件：**
- `backend/alembic/versions/xxx_hazard_redesign.py`（自动生成后需手动调整）

**变更：**
1. 生成自动迁移
2. 手动在迁移脚本中加入 `UPDATE hazards SET description = content WHERE description IS NULL`
3. 执行 `alembic upgrade head`

### Step 7: 测试验证

1. 使用更新后的导入模板导入测试数据
2. 检查隐患列表页字段展示是否正确
3. 检查筛选功能是否正常
4. 创建复核任务，确认流程不受影响
5. 检查旧数据（改造前导入的隐患）是否正常显示

---

## 风险与应对

| 风险 | 应对措施 |
|-----|---------|
| `content` → `description` 迁移遗漏历史数据 | 迁移脚本中显式执行 UPDATE，迁移后抽样检查 |
| 前端列过多导致表格过宽 | 采用横向滚动 + 固定关键列，或增加列展示设置 |
| 导入 Excel 字段名与用户文件不完全一致 | 导入时支持多种列名别名匹配（如"重大隐患描述"和"举报问题描述"） |
| 新增字段导致现有测试失败 | 同步更新测试数据和测试断言 |

---

## 实施建议

这是一个涉及数据库、后端、前端、导入逻辑的多文件改造。推荐按以下顺序执行：

1. 先做数据库模型 + Alembic 迁移
2. 再更新后端 API 和导入服务
3. 最后更新前端页面
4. 全程保持测试验证

如果你希望，我可以调用 `oh-my-claudecode:team` 启动并行团队来分块执行这个计划，或者通过 `ralph` 顺序执行。请告诉我你的偏好。
