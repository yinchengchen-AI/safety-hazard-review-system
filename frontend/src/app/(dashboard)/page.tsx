"use client"
import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Spin, message, Empty } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/lib/userStore'
import request from '@/lib/api'

interface Overview {
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  reviewed_count: number
  review_count: number
  task_count: number
  coverage_rate: number
  pass_rate: number
}

export default function DashboardPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const isLoading = useUserStore((s) => s.isLoading)
  const [data, setData] = useState<Overview | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [isLoading, user, router])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const r = (await request.get('/statistics/overview')) as Overview
        setData(r)
      } catch (err: any) {
        message.error(err?.detail || '加载失败')
      } finally {
        setDataLoading(false)
      }
    })()
  }, [user])

  if (isLoading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (dataLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!data) {
    return <Empty description="暂无数据" />
  }

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="隐患总数" value={data.total_hazards} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待复核" value={data.pending_count} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已通过" value={data.passed_count} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="未通过" value={data.failed_count} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={8}>
          <Card title="覆盖率">
            <Statistic title="已复核 / 总数" value={data.coverage_rate * 100} precision={2} suffix="%" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="通过率">
            <Statistic title="已通过 / 已复核" value={data.pass_rate * 100} precision={2} suffix="%" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="复核任务">
            <Statistic title="任务总数" value={data.task_count} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
