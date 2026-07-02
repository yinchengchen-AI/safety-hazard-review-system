"use client"
import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Spin, message } from 'antd'
import { Line } from '@ant-design/charts'
import request from '@/lib/api'

interface Overview {
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  task_count: number
  coverage_rate: number
  pass_rate: number
}

interface TrendPoint {
  period: string
  total_hazards: number
  passed_count: number
  failed_count: number
  review_count: number
}

export default function StatisticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [ov, tr] = await Promise.all([
          request.get('/statistics/overview') as Promise<Overview>,
          request.get('/statistics/trend') as Promise<TrendPoint[]>,
        ])
        setOverview(ov)
        setTrend(tr)
      } catch (err: any) {
        message.error(err?.detail || '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Spin size="large" />

  return (
    <div>
      {overview && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="隐患总数" value={overview.total_hazards} /></Card></Col>
          <Col span={6}><Card><Statistic title="待复核" value={overview.pending_count} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="覆盖率" value={(overview.coverage_rate * 100).toFixed(2)} suffix="%" /></Card></Col>
          <Col span={6}><Card><Statistic title="通过率" value={(overview.pass_rate * 100).toFixed(2)} suffix="%" /></Card></Col>
        </Row>
      )}
      <Card title="每日趋势">
        {trend.length > 0 ? (
          <Line
            data={trend.flatMap((t) => [
              { date: t.period, value: t.passed_count, type: '已通过' },
              { date: t.period, value: t.failed_count, type: '未通过' },
              { date: t.period, value: t.review_count, type: '已复核' },
            ])}
            xField="date"
            yField="value"
            colorField="type"
            height={320}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无趋势数据</div>
        )}
      </Card>
    </div>
  )
}
