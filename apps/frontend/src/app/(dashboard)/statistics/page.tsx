"use client"
import { useEffect, useState } from 'react'
import { Card, Col, Radio, Row, Statistic, Spin, message } from 'antd'
import { Line } from '@ant-design/charts'
import request, { getErrorMessage } from '@/lib/api'

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

type Granularity = 'day' | 'month'

export default function StatisticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [granularity, setGranularity] = useState<Granularity>('day')

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const ov = (await request.get('/statistics/overview', { signal: controller.signal })) as Overview
        setOverview(ov)
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
        message.error(getErrorMessage(err) || '概览加载失败')
      } finally {
        setOverviewLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      setTrendLoading(true)
      try {
        const tr = (await request.get('/statistics/trend', {
          params: { granularity },
          signal: controller.signal,
        })) as TrendPoint[]
        setTrend(tr)
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
        message.error(getErrorMessage(err) || '趋势加载失败')
      } finally {
        setTrendLoading(false)
      }
    })()
    return () => controller.abort()
  }, [granularity])

  if (overviewLoading && trendLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      {overview && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card><Statistic title="隐患总数" value={overview.total_hazards} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="待复核" value={overview.pending_count} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="覆盖率" value={(overview.coverage_rate * 100).toFixed(2)} suffix="%" /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="通过率" value={(overview.pass_rate * 100).toFixed(2)} suffix="%" /></Card></Col>
        </Row>
      )}
      <Card
        title={granularity === 'day' ? '每日趋势' : '每月趋势'}
        extra={
          <Radio.Group
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            optionType="button"
            size="small"
            options={[
              { value: 'day', label: '按日' },
              { value: 'month', label: '按月' },
            ]}
          />
        }
      >
        <Spin spinning={trendLoading}>
          {trend.length > 0 ? (
            <div style={{ minWidth: 0, width: '100%' }}>
              <Line
                data={trend.flatMap((t) => [
                  { date: t.period, value: t.passed_count, type: '已通过' },
                  { date: t.period, value: t.failed_count, type: '未通过' },
                  { date: t.period, value: t.review_count, type: '已复核' },
                ])}
                xField="date"
                yField="value"
                colorField="type"
                height={280}
              />
            </div>
          ) : (
            !trendLoading && <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无趋势数据</div>
          )}
        </Spin>
      </Card>
    </div>
  )
}
