import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Empty,
  Spin,
  Table,
  Progress,
} from 'antd'
import {
  WarningOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { Pie, Line, Bar } from '@ant-design/charts'
import dayjs from 'dayjs'
import {
  getOverviewStats,
  getReportingUnitStats,
  getBatchStats,
  getInspectorStats,
  getTrendStats,
} from '../../api/statistics'
import './Statistics.css'

type OverviewStatistics = {
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

type TrendStatistics = {
  points: TrendPoint[]
}

const STATUS_COLORS = {
  pending: '#fa8c16',
  passed: '#52c41a',
  failed: '#ff4d4f',
}

function OverviewCard({
  title,
  value,
  suffix = '',
  icon,
  colorClass,
  delay,
}: {
  title: string
  value: number
  suffix?: string
  icon: React.ReactNode
  colorClass: string
  delay: number
}) {
  return (
    <Card
      className={`statistics-card ${colorClass} fade-in`}
      style={{ animationDelay: `${delay}ms` }}
      bordered={false}
    >
      <div className="statistics-card__inner">
        <div>
          <span className="statistics-card__label">{title}</span>
          <div className="statistics-card__value">
            {value}{suffix}
          </div>
        </div>
        <div
          className="statistics-card__icon"
          style={{
            background: 'rgba(0,0,0,0.04)',
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}

function ChartCard({
  title,
  delay,
  children,
}: {
  title: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <Card
      title={title}
      className="statistics-chart-card fade-in"
      style={{ animationDelay: `${delay}ms` }}
      bordered={false}
    >
      {children}
    </Card>
  )
}

export default function Statistics() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewStatistics | null>(null)
  const [reportingUnits, setReportingUnits] = useState<ReportingUnitItem[]>([])
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [inspectors, setInspectors] = useState<InspectorItem[]>([])
  const [trend, setTrend] = useState<TrendStatistics | null>(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const end = dayjs()
        const start = end.subtract(30, 'day')
        const [
          overviewRes,
          reportingRes,
          batchRes,
          inspectorRes,
          trendRes,
        ] = await Promise.all([
          getOverviewStats(),
          getReportingUnitStats(),
          getBatchStats(),
          getInspectorStats(),
          getTrendStats({
            start_date: start.format('YYYY-MM-DD'),
            end_date: end.format('YYYY-MM-DD'),
          }),
        ])
        setOverview((overviewRes as any) || null)
        setReportingUnits((reportingRes as any) || [])
        setBatches((batchRes as any) || [])
        setInspectors((inspectorRes as any) || [])
        setTrend((trendRes as any) || null)
      } catch (err) {
        console.error('Failed to load statistics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const pieData = useMemo(() => {
    if (!overview) return []
    return [
      { status: '待复核', count: overview.pending_count, color: STATUS_COLORS.pending },
      { status: '已通过', count: overview.passed_count, color: STATUS_COLORS.passed },
      { status: '未通过', count: overview.failed_count, color: STATUS_COLORS.failed },
    ].filter((d) => d.count > 0)
  }, [overview])

  const lineData = useMemo(() => {
    if (!trend?.points?.length) return []
    return trend.points.map((p) => ({
      period: dayjs(p.period).format('MM-DD'),
      total_hazards: p.total_hazards,
    }))
  }, [trend])

  const reportingStackData = useMemo(() => {
    const top = [...reportingUnits]
      .sort((a, b) => b.total_hazards - a.total_hazards)
      .slice(0, 12)
    const rows: { reporting_unit: string; count: number; status: string }[] = []
    top.forEach((d) => {
      rows.push({ reporting_unit: d.reporting_unit, count: d.pending_count, status: '待复核' })
      rows.push({ reporting_unit: d.reporting_unit, count: d.passed_count, status: '已通过' })
      rows.push({ reporting_unit: d.reporting_unit, count: d.failed_count, status: '未通过' })
    })
    return rows
  }, [reportingUnits])

  const inspectorBarData = useMemo(() => {
    return [...inspectors]
      .sort((a, b) => b.reviewed_hazard_count - a.reviewed_hazard_count)
      .slice(0, 10)
      .map((d) => ({
        inspector_name: d.inspector_name,
        reviewed_hazard_count: d.reviewed_hazard_count,
      }))
  }, [inspectors])

  const pieConfig = {
    data: pieData,
    angleField: 'count',
    colorField: 'status',
    color: ({ status }: { status: string }) => {
      const map: Record<string, string> = {
        待复核: STATUS_COLORS.pending,
        已通过: STATUS_COLORS.passed,
        未通过: STATUS_COLORS.failed,
      }
      return map[status] || '#999'
    },
    legend: {
      position: 'bottom',
    },
    tooltip: {
      items: [{ field: 'count', name: '数量' }],
    },
    label: {
      text: 'count',
      style: { fontSize: 12 },
    },
    innerRadius: 0.6,
  }

  const lineConfig = {
    data: lineData,
    xField: 'period',
    yField: 'total_hazards',
    smooth: true,
    color: '#1677ff',
    point: {
      size: 3,
      shape: 'circle',
    },
    axis: {
      x: { title: '日期' },
      y: { title: '隐患数量' },
    },
    tooltip: {
      items: [{ field: 'total_hazards', name: '隐患数' }],
    },
  }

  const reportingBarConfig = {
    data: reportingStackData,
    xField: 'reporting_unit',
    yField: 'count',
    colorField: 'status',
    transform: [{ type: 'stackY' }],
    color: ({ status }: { status: string }) => {
      const map: Record<string, string> = {
        '待复核': STATUS_COLORS.pending,
        '已通过': STATUS_COLORS.passed,
        '未通过': STATUS_COLORS.failed,
      }
      return map[status] || '#999'
    },
    axis: {
      x: { title: false },
      y: { title: '数量' },
    },
    tooltip: {
      items: [{ field: 'count', name: '数量' }],
    },
    legend: {
      position: 'top-right',
    },
  }

  const inspectorBarConfig = {
    data: inspectorBarData,
    xField: 'reviewed_hazard_count',
    yField: 'inspector_name',
    color: '#722ed1',
    axis: {
      x: { title: '复核隐患数' },
      y: { title: false },
    },
    tooltip: {
      items: [{ field: 'reviewed_hazard_count', name: '复核隐患数' }],
    },
  }

  const batchColumns = [
    {
      title: '批次名称',
      dataIndex: 'batch_name',
      key: 'batch_name',
    },
    {
      title: '隐患总数',
      dataIndex: 'total_hazards',
      key: 'total_hazards',
      align: 'center' as const,
    },
    {
      title: '已复核',
      dataIndex: 'reviewed_count',
      key: 'reviewed_count',
      align: 'center' as const,
    },
    {
      title: '已通过',
      dataIndex: 'passed_count',
      key: 'passed_count',
      align: 'center' as const,
    },
    {
      title: '未通过',
      dataIndex: 'failed_count',
      key: 'failed_count',
      align: 'center' as const,
    },
    {
      title: '覆盖率',
      key: 'coverage_rate',
      align: 'center' as const,
      render: (_: unknown, record: BatchItem) => (
        <Progress
          percent={Math.round((record.coverage_rate || 0) * 100)}
          size="small"
          strokeColor="#1677ff"
        />
      ),
    },
    {
      title: '通过率',
      key: 'pass_rate',
      align: 'center' as const,
      render: (_: unknown, record: BatchItem) => (
        <Progress
          percent={Math.round((record.pass_rate || 0) * 100)}
          size="small"
          strokeColor="#52c41a"
        />
      ),
    },
  ]

  return (
    <div className="statistics-container">
      <div
        className="statistics-header fade-in"
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          统计分析
        </h2>
        <p
          style={{
            margin: '4px 0 0',
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
        >
          隐患复核数据全景概览
        </p>
      </div>

      <Spin spinning={loading} tip="加载中...">
        {/* Overview Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="隐患总数"
              value={overview?.total_hazards || 0}
              icon={<WarningOutlined />}
              colorClass="statistics-card--blue"
              delay={60}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="待复核"
              value={overview?.pending_count || 0}
              icon={<FileSearchOutlined />}
              colorClass="statistics-card--amber"
              delay={120}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="已通过"
              value={overview?.passed_count || 0}
              icon={<CheckCircleOutlined />}
              colorClass="statistics-card--green"
              delay={180}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="未通过"
              value={overview?.failed_count || 0}
              icon={<CloseCircleOutlined />}
              colorClass="statistics-card--red"
              delay={240}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="复核率"
              value={Math.round((overview?.coverage_rate || 0) * 100)}
              suffix="%"
              icon={<BarChartOutlined />}
              colorClass="statistics-card--purple"
              delay={300}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <OverviewCard
              title="任务数"
              value={overview?.task_count || 0}
              icon={<TeamOutlined />}
              colorClass="statistics-card--cyan"
              delay={360}
            />
          </Col>
        </Row>

        {/* Charts Row 1: Pie + Line */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <ChartCard title="隐患状态分布" delay={300}>
              {pieData.length ? (
                <Pie {...(pieConfig as any)} height={360} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </ChartCard>
          </Col>
          <Col xs={24} lg={12}>
            <ChartCard title="30天隐患趋势" delay={360}>
              {lineData.length ? (
                <Line {...(lineConfig as any)} height={360} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </ChartCard>
          </Col>
        </Row>

        {/* Charts Row 2: Reporting Unit + Inspector */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <ChartCard title="上报单位隐患分布" delay={420}>
              {reportingStackData.length ? (
                <Bar {...(reportingBarConfig as any)} height={400} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </ChartCard>
          </Col>
          <Col xs={24} lg={12}>
            <ChartCard title="检查人员工作量 TOP10" delay={480}>
              {inspectorBarData.length ? (
                <Bar {...(inspectorBarConfig as any)} height={400} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </ChartCard>
          </Col>
        </Row>

        {/* Batch Progress Table */}
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <ChartCard title="批次进度" delay={540}>
              <Table
                dataSource={batches}
                columns={batchColumns}
                rowKey="batch_id"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="暂无数据" /> }}
              />
            </ChartCard>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
