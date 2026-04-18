# 统计分析页面重新设计 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新设计统计分析页面，包含概览卡片、隐患状态分布环形图、时间趋势折线图、上报单位堆叠条形图、复核人员条形图、批次进度表格。

**Architecture:** 后端补充 `/overview` 端点和排序限制；前端使用 `@ant-design/charts` v2 的 Pie/Line/Bar 组件，Ant Design 的 Card/Row/Col/Table/Progress 布局。

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async), React 18 + TypeScript + Ant Design 5 + @ant-design/charts v2

---

## 文件结构

### 后端
- `backend/app/routers/statistics.py` — 修改：添加 `/overview` 端点，为 `/enterprise` 和 `/inspector` 添加排序和限制
- `backend/app/schemas/statistics.py` — 修改：添加 `OverviewStatistics` schema

### 前端
- `frontend/src/pages/Statistics/Statistics.tsx` — 重写：完整的统计页面布局
- `frontend/src/api/statistics.ts` — 修改：添加 `getOverviewStats` 和 `getBatchStats` 接口

---

## Task 1: 后端 — 添加概览统计端点

**Files:**
- Modify: `backend/app/routers/statistics.py`
- Modify: `backend/app/schemas/statistics.py`

- [ ] **Step 1: 添加 OverviewStatistics schema**

在 `backend/app/schemas/statistics.py` 的 `TrendStatistics` 类之前添加：

```python
class OverviewStatistics(BaseModel):
    total_hazards: int
    pending_count: int
    passed_count: int
    failed_count: int
    review_count: int
    task_count: int
    coverage_rate: float = 0.0
    pass_rate: float = 0.0
```

- [ ] **Step 2: 添加 /overview 端点**

在 `backend/app/routers/statistics.py` 的 `/reporting-unit` 端点之前添加：

```python
@router.get("/overview", response_model=OverviewStatistics)
async def overview_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            func.count(Hazard.id).label("total_hazards"),
            func.sum(case((Hazard.status == "pending", 1), else_=0)).label("pending_count"),
            func.sum(case((Hazard.status == "passed", 1), else_=0)).label("passed_count"),
            func.sum(case((Hazard.status == "failed", 1), else_=0)).label("failed_count"),
            func.coalesce(func.sum(Hazard.review_count), 0).label("review_count"),
        )
        .where(Hazard.deleted_at.is_(None))
    )
    row = result.one()

    total = row.total_hazards or 0
    pending = row.pending_count or 0
    passed = row.passed_count or 0
    failed = row.failed_count or 0
    review_count = row.review_count or 0

    # 获取任务数
    task_result = await db.execute(
        select(func.count(ReviewTask.id)).where(ReviewTask.deleted_at.is_(None))
    )
    task_count = task_result.scalar() or 0

    reviewed = passed + failed
    coverage_rate = round(reviewed / total, 4) if total else 0.0
    pass_rate = round(passed / reviewed, 4) if reviewed else 0.0

    return OverviewStatistics(
        total_hazards=total,
        pending_count=pending,
        passed_count=passed,
        failed_count=failed,
        review_count=review_count,
        task_count=task_count,
        coverage_rate=coverage_rate,
        pass_rate=pass_rate,
    )
```

- [ ] **Step 3: 导入 OverviewStatistics**

在 `backend/app/routers/statistics.py` 的导入语句中，将：
```python
from app.schemas import (
    EnterpriseStatistics,
    BatchStatistics,
    InspectorStatistics,
    ReportingUnitStatistics,
    TrendStatistics,
    TrendPoint,
)
```
改为：
```python
from app.schemas import (
    EnterpriseStatistics,
    BatchStatistics,
    InspectorStatistics,
    ReportingUnitStatistics,
    TrendStatistics,
    TrendPoint,
    OverviewStatistics,
)
```

- [ ] **Step 4: 重启后端验证**

```bash
cd D:/ClaudeCode/safety-hazard-review-system/backend
# 如果 uvicorn 正在运行，需要重启
# 测试端点
curl -s http://localhost:8000/api/v1/statistics/overview -H "Authorization: Bearer $(curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=admin&password=admin123' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")"
```

---

## Task 2: 后端 — 为 /enterprise 和 /inspector 添加排序和限制

**Files:**
- Modify: `backend/app/routers/statistics.py`

- [ ] **Step 1: 修改 /enterprise 端点**

将 `/enterprise` 端点的查询改为：

```python
@router.get("/enterprise", response_model=list[EnterpriseStatistics])
async def enterprise_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            Enterprise.id,
            Enterprise.name,
            func.count(Hazard.id).label("total_hazards"),
            func.sum(case((Hazard.status == "pending", 1), else_=0)).label("pending_count"),
            func.sum(case((Hazard.status == "passed", 1), else_=0)).label("passed_count"),
            func.sum(case((Hazard.status == "failed", 1), else_=0)).label("failed_count"),
            func.coalesce(func.sum(Hazard.review_count), 0).label("review_count"),
        )
        .join(Hazard, and_(Hazard.enterprise_id == Enterprise.id, Hazard.deleted_at.is_(None)))
        .where(Enterprise.deleted_at.is_(None))
        .group_by(Enterprise.id, Enterprise.name)
        .order_by(func.count(Hazard.id).desc())
        .limit(12)
    )

    stats = []
    for row in result.all():
        stats.append(EnterpriseStatistics(
            enterprise_id=row.id,
            enterprise_name=row.name,
            total_hazards=row.total_hazards or 0,
            pending_count=row.pending_count or 0,
            passed_count=row.passed_count or 0,
            failed_count=row.failed_count or 0,
            review_count=row.review_count or 0,
        ))
    return stats
```

- [ ] **Step 2: 修改 /inspector 端点**

将 `/inspector` 端点的查询改为：

```python
@router.get("/inspector", response_model=list[InspectorStatistics])
async def inspector_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            User.id,
            User.username,
            func.count(distinct(ReviewTask.id)).label("task_count"),
            func.count(distinct(TaskHazard.id)).label("reviewed_hazard_count"),
        )
        .join(ReviewTask, ReviewTask.creator_id == User.id)
        .outerjoin(TaskHazard, TaskHazard.reviewer_id == User.id)
        .where(User.deleted_at.is_(None), ReviewTask.deleted_at.is_(None))
        .group_by(User.id, User.username)
        .order_by(func.count(distinct(TaskHazard.id)).desc())
        .limit(10)
    )

    stats = []
    for row in result.all():
        stats.append(InspectorStatistics(
            inspector_id=row.id,
            inspector_name=row.username,
            task_count=row.task_count or 0,
            reviewed_hazard_count=row.reviewed_hazard_count or 0,
        ))
    return stats
```

---

## Task 3: 前端 — 添加 API 接口

**Files:**
- Modify: `frontend/src/api/statistics.ts`

- [ ] **Step 1: 添加新接口**

将 `frontend/src/api/statistics.ts` 改为：

```typescript
import request from './request'

export const getOverviewStats = () => request.get('/statistics/overview')
export const getEnterpriseStats = () => request.get('/statistics/enterprise')
export const getReportingUnitStats = () => request.get('/statistics/reporting-unit')
export const getBatchStats = () => request.get('/statistics/batch')
export const getInspectorStats = () => request.get('/statistics/inspector')
export const getTrendStats = (params: any) => request.get('/statistics/trend', { params })
```

---

## Task 4: 前端 — 重写 Statistics 页面

**Files:**
- Rewrite: `frontend/src/pages/Statistics/Statistics.tsx`

- [ ] **Step 1: 重写 Statistics.tsx**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Empty, Spin, Table, Progress, Statistic } from 'antd'
import { Pie, Line, Bar } from '@ant-design/charts'
import {
  WarningOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import {
  getOverviewStats,
  getReportingUnitStats,
  getBatchStats,
  getInspectorStats,
  getTrendStats,
} from '../../api/statistics'
import dayjs from 'dayjs'

// ─── Types ───────────────────────────────────────────

type OverviewData = {
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  review_count: number
  task_count: number
  coverage_rate: number
  pass_rate: number
}

type ReportingUnitItem = {
  reporting_unit: string
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  review_count: number
}

type BatchItem = {
  batch_id: string
  batch_name: string
  total_hazards: number
  reviewed_count: number
  passed_count: number
  failed_count: number
  coverage_rate: number
  pass_rate: number
}

type InspectorItem = {
  inspector_id: string
  inspector_name: string
  task_count: number
  reviewed_hazard_count: number
}

type TrendPoint = {
  period: string
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  review_count: number
  task_count: number
  coverage_rate: number
  pass_rate: number
}

// ─── Overview Card ───────────────────────────────────

function OverviewCard({
  title,
  value,
  icon,
  color,
  suffix,
}: {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  suffix?: string
}) {
  return (
    <Card
      bordered={false}
      bodyStyle={{ padding: '20px 24px' }}
      style={{ borderRadius: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#262626', lineHeight: 1 }}>
            {value}{suffix}
          </div>
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `${color}15`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────

export default function Statistics() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [reportingUnits, setReportingUnits] = useState<ReportingUnitItem[]>([])
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [inspectors, setInspectors] = useState<InspectorItem[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const end = dayjs()
      const start = end.subtract(30, 'day')
      const [ov, ru, ba, ins, tr] = await Promise.all([
        getOverviewStats(),
        getReportingUnitStats(),
        getBatchStats(),
        getInspectorStats(),
        getTrendStats({
          start_date: start.format('YYYY-MM-DD'),
          end_date: end.format('YYYY-MM-DD'),
        }),
      ])
      setOverview((ov as any) || null)
      setReportingUnits((ru as any) || [])
      setBatches((ba as any) || [])
      setInspectors((ins as any) || [])
      setTrend(((tr as any)?.points) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  // ── 1. 隐患状态分布（环形图）────────────────────────
  const statusPieData = useMemo(() => {
    if (!overview) return []
    return [
      { status: '待复核', count: overview.pending_count, color: '#fa8c16' },
      { status: '已通过', count: overview.passed_count, color: '#52c41a' },
      { status: '未通过', count: overview.failed_count, color: '#ff4d4f' },
    ].filter((d) => d.count > 0)
  }, [overview])

  const pieConfig = {
    data: statusPieData,
    angleField: 'count',
    colorField: 'status',
    color: ['#fa8c16', '#52c41a', '#ff4d4f'],
    innerRadius: 0.6,
    label: {
      text: 'count',
      style: { fontSize: 14, fontWeight: 500 },
    },
    legend: {
      position: 'bottom',
    },
    tooltip: {
      items: [{ field: 'count', name: '数量' }],
    },
    statistic: {
      title: {
        text: '隐患总数',
        style: { fontSize: 14, color: '#8c8c8c' },
      },
      value: {
        text: overview?.total_hazards?.toString() || '0',
        style: { fontSize: 24, fontWeight: 700, color: '#262626' },
      },
    },
  }

  // ── 2. 时间趋势（折线图）────────────────────────────
  const trendLineData = useMemo(() => {
    return trend.map((d) => ({
      period: d.period.slice(5), // MM-DD
      total_hazards: d.total_hazards,
    }))
  }, [trend])

  const lineConfig = {
    data: trendLineData,
    xField: 'period',
    yField: 'total_hazards',
    color: '#1677ff',
    smooth: true,
    point: {
      size: 4,
      shape: 'circle',
    },
    axis: {
      x: { label: { autoHide: true, style: { fontSize: 11 } } },
      y: { grid: { line: { style: { stroke: 'rgba(0,0,0,0.03)' } } } },
    },
    tooltip: {
      items: [{ field: 'total_hazards', name: '隐患数' }],
    },
  }

  // ── 3. 上报单位隐患数量 TOP12（堆叠横向条形图）──────
  const stackData = useMemo(() => {
    const rows: { reporting_unit: string; count: number; status: string }[] = []
    reportingUnits.forEach((d) => {
      rows.push({ reporting_unit: d.reporting_unit, count: d.pending_count, status: '待复核' })
      rows.push({ reporting_unit: d.reporting_unit, count: d.passed_count, status: '已通过' })
      rows.push({ reporting_unit: d.reporting_unit, count: d.failed_count, status: '未通过' })
    })
    return rows
  }, [reportingUnits])

  const barConfig = {
    data: stackData,
    xField: 'reporting_unit',
    yField: 'count',
    colorField: 'status',
    color: ['#1677ff', '#52c41a', '#ff4d4f'],
    axis: {
      x: { label: { autoRotate: false, autoHide: true, style: { fontSize: 12 } } },
      y: { grid: { line: { style: { stroke: 'rgba(0,0,0,0.03)' } } } },
    },
    tooltip: {
      items: [{ field: 'count', name: '数量' }],
    },
    legend: { position: 'top-right' },
  }

  // ── 4. 复核人员工作量 TOP10（横向条形图）────────────
  const inspectorBarData = useMemo(() => {
    return inspectors.map((d) => ({
      inspector_name: d.inspector_name,
      reviewed_hazard_count: d.reviewed_hazard_count,
    }))
  }, [inspectors])

  const inspectorBarConfig = {
    data: inspectorBarData,
    xField: 'inspector_name',
    yField: 'reviewed_hazard_count',
    color: '#722ed1',
    axis: {
      x: { label: { autoRotate: false, autoHide: true, style: { fontSize: 12 } } },
      y: { grid: { line: { style: { stroke: 'rgba(0,0,0,0.03)' } } } },
    },
    tooltip: {
      items: [{ field: 'reviewed_hazard_count', name: '复核隐患数' }],
    },
  }

  // ── 5. 批次复核进度（表格）──────────────────────────
  const batchColumns = [
    {
      title: '批次名称',
      dataIndex: 'batch_name',
      key: 'batch_name',
      ellipsis: true,
    },
    {
      title: '隐患总数',
      dataIndex: 'total_hazards',
      key: 'total_hazards',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '已复核',
      dataIndex: 'reviewed_count',
      key: 'reviewed_count',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '完成率',
      key: 'coverage',
      width: 180,
      render: (_: any, record: BatchItem) => (
        <Progress
          percent={Math.round(record.coverage_rate * 100)}
          size="small"
          status={record.coverage_rate >= 1 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '通过率',
      key: 'pass',
      width: 180,
      render: (_: any, record: BatchItem) => (
        <Progress
          percent={Math.round(record.pass_rate * 100)}
          size="small"
          strokeColor="#52c41a"
        />
      ),
    },
  ]

  return (
    <div>
      {/* 页面标题 */}
      <div
        className="app-card animate-fade-in-up delay-0"
        style={{ marginBottom: 24, padding: '20px 24px' }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
          统计分析
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          全面洞察隐患数据与复核进度
        </p>
      </div>

      <Spin spinning={loading} tip="加载中...">
        {/* 概览卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} lg={6}>
            <OverviewCard
              title="隐患总数"
              value={overview?.total_hazards || 0}
              icon={<WarningOutlined />}
              color="#1677ff"
            />
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <OverviewCard
              title="待复核"
              value={overview?.pending_count || 0}
              icon={<FileSearchOutlined />}
              color="#fa8c16"
            />
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <OverviewCard
              title="已通过"
              value={overview?.passed_count || 0}
              icon={<CheckCircleOutlined />}
              color="#52c41a"
            />
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <OverviewCard
              title="未通过"
              value={overview?.failed_count || 0}
              icon={<CloseCircleOutlined />}
              color="#ff4d4f"
            />
          </Col>
        </Row>

        {/* 第一行图表：状态分布 + 时间趋势 */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card
              title="隐患状态分布"
              bordered={false}
              className="app-card animate-fade-in-up"
              style={{ animationDelay: '60ms' }}
            >
              {statusPieData.length ? (
                <Pie {...(pieConfig as any)} height={320} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="隐患趋势（近30天）"
              bordered={false}
              className="app-card animate-fade-in-up"
              style={{ animationDelay: '120ms' }}
            >
              {trendLineData.length ? (
                <Line {...(lineConfig as any)} height={320} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* 第二行图表：上报单位 + 复核人员 */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card
              title="上报单位隐患数量 TOP12"
              bordered={false}
              className="app-card animate-fade-in-up"
              style={{ animationDelay: '180ms' }}
            >
              {stackData.length ? (
                <Bar {...(barConfig as any)} height={400} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="复核人员工作量 TOP10"
              bordered={false}
              className="app-card animate-fade-in-up"
              style={{ animationDelay: '240ms' }}
            >
              {inspectorBarData.length ? (
                <Bar {...(inspectorBarConfig as any)} height={400} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* 批次进度表格 */}
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card
              title="批次复核进度"
              bordered={false}
              className="app-card animate-fade-in-up"
              style={{ animationDelay: '300ms' }}
            >
              <Table
                dataSource={batches}
                columns={batchColumns}
                rowKey="batch_id"
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                size="middle"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
```

---

## 自审检查

**1. Spec 覆盖检查：**
- [x] 概览卡片（隐患总数、待复核、已通过、未通过）— Task 4
- [x] 隐患状态分布环形图 — Task 4
- [x] 时间趋势折线图 — Task 4
- [x] 上报单位堆叠横向条形图 — Task 4
- [x] 复核人员横向条形图 — Task 4
- [x] 批次进度表格 — Task 4
- [x] 后端排序和限制 — Task 1, 2
- [x] 空值处理 — 后端已包含 `.isnot(None)` 和 `!= ""`

**2. Placeholder 扫描：**
- [x] 无 TBD/TODO
- [x] 所有代码完整
- [x] 所有类型定义完整

**3. 类型一致性：**
- [x] `OverviewStatistics` schema 与前端 `OverviewData` 类型匹配
- [x] API 接口名称前后端一致

---

## 执行方式

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-statistics-page-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
