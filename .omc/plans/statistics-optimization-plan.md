# 统计分析页面优化计划

## 需求摘要

基于现有 `@ant-design/charts` 库，对 `Statistics.tsx` 进行图表可视化增强，重点解决当前"按批次统计"仅为纯文本列表的短板，并补充状态分布和趋势分析的维度。

## 优化范围

用户明确选择的三项优化：
1. **批次统计改成柱状图** — 将当前纯文本列表替换为柱状图，展示各批次的隐患总数、复核数、通过数
2. **隐患状态堆叠图** — 新增按企业/批次维度的状态堆叠柱状图，直观展示 pending/passed/failed 分布
3. **趋势图增加更多指标** — 在趋势折线图中支持切换显示：隐患总数、复核数、通过率、覆盖率

## 当前代码基线

- 前端页面：`frontend/src/pages/Statistics/Statistics.tsx`（`@ant-design/charts` 的 Column/Line/Pie）
- 后端接口：`backend/app/routers/statistics.py`
  - `GET /api/v1/statistics/enterprise` — 企业统计
  - `GET /api/v1/statistics/batch` — 批次统计（已返回 total_hazards/reviewed_count/passed_count/failed_count/coverage_rate/pass_rate）
  - `GET /api/v1/statistics/inspector` — 监管人员统计
  - `GET /api/v1/statistics/trend` — 趋势统计（返回 points 数组）
- 后端 Schema：`backend/app/schemas/statistics.py`

## 后端变更

### 1. 趋势统计接口补充通过率和覆盖率
**文件：** `backend/app/routers/statistics.py:120-153`

当前 `trend` 接口返回的 `TrendPoint` 只有 `total_hazards/pending_count/passed_count/failed_count/review_count/task_count`，缺少 `coverage_rate` 和 `pass_rate`。

**修改：** 在 `trend_statistics` 函数中，对每个 `row`（`StatisticsDaily`）计算：
- `coverage_rate = round((row.review_count) / row.total_hazards, 4) if row.total_hazards else 0.0`
- `pass_rate = round((row.passed_count) / row.review_count, 4) if row.review_count else 0.0`

**文件：** `backend/app/schemas/statistics.py:34-45`

在 `TrendPoint` 中新增：
- `coverage_rate: float = 0.0`
- `pass_rate: float = 0.0`

## 前端变更

### 1. 批次统计改为柱状图
**文件：** `frontend/src/pages/Statistics/Statistics.tsx:133-143`

将当前按批次统计的纯文本 `<div>` 列表替换为 `@ant-design/charts` 的 `Column` 柱状图。

**配置：**
- 数据：`batchData.map(d => ({ name: d.batch_name, value: d.total_hazards, type: '隐患总数' }))` 结合 `reviewed_count` 和 `passed_count` 做分组/堆叠
- 建议采用 **分组柱状图**：每个批次展示三个柱子（总数、已复核数、通过数）
- `xField: 'name'`, `yField: 'value'`, `seriesField: 'type'`, `isGroup: true`

### 2. 新增隐患状态堆叠柱状图
**文件：** `frontend/src/pages/Statistics/Statistics.tsx`

新增一个 `Card`，标题为"按企业隐患状态分布"，使用 `Column` 堆叠柱状图。

**配置：**
- 数据：`enterpriseData.flatMap(d => [
  { name: d.enterprise_name, value: d.pending_count, type: '待复核' },
  { name: d.enterprise_name, value: d.passed_count, type: '已通过' },
  { name: d.enterprise_name, value: d.failed_count, type: '未通过' },
])`
- `xField: 'name'`, `yField: 'value'`, `seriesField: 'type'`, `isStack: true`
- 颜色映射：待复核(orange)、已通过(green)、未通过(red)

### 3. 趋势图增加指标切换
**文件：** `frontend/src/pages/Statistics/Statistics.tsx:112-124`

当前趋势图固定显示"隐患总数"和"复核数"。需要增加 `Select` 下拉框，让用户切换要显示的指标。

**指标选项：**
- 隐患总数 + 复核数（默认）
- 通过率 + 覆盖率（百分比双轴）

**交互设计：**
- 在 `Card` 的 `extra` 区域增加 `<Select>`，选项为上述两项
- 当选择"通过率 + 覆盖率"时，折线图使用双 Y 轴（`yAxis` 配置百分比格式），数据来自后端新增的 `coverage_rate` 和 `pass_rate`

### 4. 页面布局调整
**文件：** `frontend/src/pages/Statistics/Statistics.tsx:97-147`

当前布局为 2x2 的 `Row/Col` 组合。新增堆叠图后，建议调整为：
- 第一行：按企业统计-隐患总数（Col 12）+ 隐患状态堆叠图（Col 12）
- 第二行：趋势统计（Col 24）
- 第三行：监管人员任务数（Col 12）+ 按批次统计柱状图（Col 12）

## 验收标准

1. 批次统计区域显示为分组柱状图，不再显示纯文本列表
2. 新增"按企业隐患状态分布"堆叠柱状图，颜色与状态语义一致
3. 趋势图支持通过下拉框切换"隐患总数/复核数"和"通过率/覆盖率"
4. 后端 `trend` 接口返回的数据包含 `coverage_rate` 和 `pass_rate`
5. 前端 `npm run build` 通过，后端 `pytest` 全部通过
6. 页面在浏览器中加载正常，图表渲染无报错

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| `@ant-design/charts` 的分组/堆叠图配置与预期不符 | 参考官方文档的 `isGroup` 和 `isStack` 示例 |
| 趋势图百分比双轴格式显示异常 | 使用 `yAxis` 的 `label.formatter` 配置为百分比 |
| `StatisticsDaily` 模型缺少某些字段导致计算报错 | 先确认模型字段存在再计算 |

## 实施步骤

1. 后端：修改 `TrendPoint` schema 和 `trend_statistics` 接口
2. 后端：运行测试确保无回归
3. 前端：批次统计改为分组柱状图
4. 前端：新增企业状态堆叠柱状图
5. 前端：趋势图增加指标切换 Select 和双轴逻辑
6. 前端：调整页面布局
7. 前端：构建验证 + 浏览器手动验证
