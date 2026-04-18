import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  List,
  Tag,
  Badge,
  Typography,
  Empty,
  Spin,
} from 'antd'
import {
  WarningOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  TeamOutlined,
  ImportOutlined,
  BarChartOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getOverviewStats,
  getTrendStats,
} from '../../api/statistics'
import { getTasks } from '../../api/task'
import { getHazards } from '../../api/hazard'
import './Dashboard.css'

const { Title, Text } = Typography

type TaskItem = {
  id: string
  name: string
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  hazard_count: number
  reviewed_count: number
}

type HazardItem = {
  id: string
  description: string
  enterprise_name: string
  status: 'pending' | 'passed' | 'failed'
  created_at: string
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const duration = 1200

  useEffect(() => {
    let raf = 0
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplay(Math.floor(eased * value))
      if (progress < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span>
      {display}
      {suffix}
    </span>
  )
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { color: string; text: string }> = {
    pending: { color: 'warning', text: '待复核' },
    completed: { color: 'success', text: '已完成' },
    cancelled: { color: 'default', text: '已取消' },
    passed: { color: 'success', text: '已通过' },
    failed: { color: 'error', text: '未通过' },
  }
  const conf = map[status] || { color: 'default', text: status }
  return <Tag color={conf.color as any}>{conf.text}</Tag>
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const width = 120
  const height = 40
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  const pathD = `M ${points.join(' L ')}`
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`

  return (
    <svg width={width} height={height} className="mini-sparkline">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalHazards: 0,
    pendingHazards: 0,
    pendingTasks: 0,
    completedTasks: 0,
    passRate: 0,
    coverageRate: 0,
  })
  const [recentTasks, setRecentTasks] = useState<TaskItem[]>([])
  const [recentHazards, setRecentHazards] = useState<HazardItem[]>([])
  const [trendPoints, setTrendPoints] = useState<number[]>([])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        const end = dayjs()
        const start = end.subtract(30, 'day')
        const [
          overviewRes,
          trendRes,
          tasksRes,
          hazardsRes,
        ] = await Promise.all([
          getOverviewStats(),
          getTrendStats({
            start_date: start.format('YYYY-MM-DD'),
            end_date: end.format('YYYY-MM-DD'),
          }),
          getTasks(),
          getHazards({ page: 1, page_size: 5 }),
        ])

        const overview = (overviewRes as any) || {}
        const totalHazards = overview.total_hazards || 0
        const pendingHazards = overview.pending_count || 0
        const passRate = overview.pass_rate || 0

        const tasksData = (tasksRes as any) || []
        const tasks = (tasksData.items || tasksData || []).slice(0, 5)
        const pendingTasks = overview.task_count
          ? (tasksData.items || tasksData || []).filter((t: TaskItem) => t.status === 'pending').length
          : 0
        const completedTasks = (tasksData.items || tasksData || []).filter((t: TaskItem) => t.status === 'completed').length

        const trendData = (trendRes as any) || {}
        const trendPointsData = (trendData.points || []).slice(-14)
        const coverageRate = overview.coverage_rate || 0

        const hazardsData = (hazardsRes as any) || {}

        setMetrics({
          totalHazards,
          pendingHazards,
          pendingTasks,
          completedTasks,
          passRate,
          coverageRate,
        })
        setRecentTasks(tasks)
        setRecentHazards(hazardsData.items || [])
        setTrendPoints(trendPointsData.map((p: any) => p.total_hazards || 0))
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const quickActions = useMemo(
    () => [
      {
        icon: <ImportOutlined />,
        label: '批量导入',
        desc: '上传隐患数据',
        color: '#1677ff',
        onClick: () => navigate('/batches/import'),
      },
      {
        icon: <FileSearchOutlined />,
        label: '复核任务',
        desc: '查看待办任务',
        color: '#722ed1',
        onClick: () => navigate('/tasks'),
      },
      {
        icon: <BarChartOutlined />,
        label: '统计分析',
        desc: '深度数据洞察',
        color: '#13c2c2',
        onClick: () => navigate('/statistics'),
      },
      {
        icon: <TeamOutlined />,
        label: '用户管理',
        desc: '权限与账号',
        color: '#fa8c16',
        onClick: () => navigate('/users'),
      },
    ],
    [navigate]
  )

  return (
    <div className="dashboard-container">
      <Spin spinning={loading} tip="加载中...">
        <div className="dashboard-header fade-in" style={{ animationDelay: '0ms' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <HomeOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              欢迎使用安全生产隐患复核系统
            </Title>
            <Text type="secondary">今天是 {dayjs().format('YYYY年M月D日 dddd')}</Text>
          </div>
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/hazards')}>
            查看隐患列表
          </Button>
        </div>

        <Row gutter={[16, 16]} className="metrics-row">
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card metric-card--blue fade-in" style={{ animationDelay: '60ms' }}>
              <div className="metric-card__inner">
                <div>
                  <Text type="secondary" className="metric-label">隐患总数</Text>
                  <div className="metric-value">
                    <AnimatedNumber value={metrics.totalHazards} />
                  </div>
                </div>
                <div className="metric-icon" style={{ background: 'rgba(22,119,255,0.08)', color: '#1677ff' }}>
                  <WarningOutlined />
                </div>
              </div>
              <div className="metric-sparkline">
                <MiniSparkline data={trendPoints} color="#1677ff" />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card metric-card--amber fade-in" style={{ animationDelay: '120ms' }}>
              <div className="metric-card__inner">
                <div>
                  <Text type="secondary" className="metric-label">待复核隐患</Text>
                  <div className="metric-value">
                    <AnimatedNumber value={metrics.pendingHazards} />
                  </div>
                </div>
                <div className="metric-icon" style={{ background: 'rgba(250,140,22,0.08)', color: '#fa8c16' }}>
                  <FileSearchOutlined />
                </div>
              </div>
              <div className="metric-trend">
                <Badge color="#fa8c16" text={`通过率 ${(metrics.passRate * 100).toFixed(1)}%`} />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card metric-card--purple fade-in" style={{ animationDelay: '180ms' }}>
              <div className="metric-card__inner">
                <div>
                  <Text type="secondary" className="metric-label">待办任务</Text>
                  <div className="metric-value">
                    <AnimatedNumber value={metrics.pendingTasks} />
                  </div>
                </div>
                <div className="metric-icon" style={{ background: 'rgba(114,46,209,0.08)', color: '#722ed1' }}>
                  <TeamOutlined />
                </div>
              </div>
              <div className="metric-trend">
                <Badge color="#722ed1" text={`已完成 ${metrics.completedTasks} 个任务`} />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card metric-card--green fade-in" style={{ animationDelay: '240ms' }}>
              <div className="metric-card__inner">
                <div>
                  <Text type="secondary" className="metric-label">覆盖率</Text>
                  <div className="metric-value">
                    <AnimatedNumber value={Math.round(metrics.coverageRate * 100)} suffix="%" />
                  </div>
                </div>
                <div className="metric-icon" style={{ background: 'rgba(82,196,26,0.08)', color: '#52c41a' }}>
                  <CheckCircleOutlined />
                </div>
              </div>
              <div className="metric-trend">
                <Badge color="#52c41a" text="近30天趋势" />
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={16}>
            <Card
              title="快捷操作"
              className="dashboard-card fade-in"
              style={{ animationDelay: '300ms' }}
              bodyStyle={{ padding: 16 }}
            >
              <Row gutter={[12, 12]}>
                {quickActions.map((action, idx) => (
                  <Col xs={12} sm={12} md={12} lg={12} xl={6} key={idx}>
                    <div className="quick-action" onClick={action.onClick}>
                      <div
                        className="quick-action__icon"
                        style={{ background: `${action.color}15`, color: action.color }}
                      >
                        {action.icon}
                      </div>
                      <div className="quick-action__text">
                        <div className="quick-action__label">{action.label}</div>
                        <div className="quick-action__desc">{action.desc}</div>
                      </div>
                      <ArrowRightOutlined className="quick-action__arrow" />
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>

            <Card
              title="最近复核任务"
              className="dashboard-card fade-in"
              style={{ marginTop: 16, animationDelay: '360ms' }}
              extra={
                <Button type="link" onClick={() => navigate('/tasks')}>
                  查看全部
                </Button>
              }
            >
              {recentTasks.length ? (
                <List
                  dataSource={recentTasks}
                  renderItem={(item) => (
                    <List.Item
                      className="task-list-item"
                      onClick={() => navigate(`/tasks/${item.id}`)}
                      actions={[<StatusTag status={item.status} key="status" />]}
                    >
                      <List.Item.Meta
                        title={
                          <div className="task-title">
                            <Text strong>{item.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(item.created_at).format('MM-DD HH:mm')}
                            </Text>
                          </div>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            隐患 {item.hazard_count} 项 · 已复核 {item.reviewed_count} 项
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title="最新隐患"
              className="dashboard-card fade-in"
              style={{ animationDelay: '420ms' }}
              extra={
                <Button type="link" onClick={() => navigate('/hazards')}>
                  查看全部
                </Button>
              }
            >
              {recentHazards.length ? (
                <List
                  dataSource={recentHazards}
                  renderItem={(item) => (
                    <List.Item className="hazard-list-item" onClick={() => navigate(`/hazards/${item.id}`)}>
                      <List.Item.Meta
                        title={
                          <div className="hazard-title">
                            <Text style={{ maxWidth: 200 }}>
                              {item.description.length > 20
                                ? item.description.slice(0, 20) + '...'
                                : item.description}
                            </Text>
                            <StatusTag status={item.status} />
                          </div>
                        }
                        description={
                          <div className="hazard-meta">
                            <Tag style={{ fontSize: 11, padding: '0 6px', lineHeight: '18px' }}>
                              {item.enterprise_name}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(item.created_at).format('MM-DD')}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无隐患" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
