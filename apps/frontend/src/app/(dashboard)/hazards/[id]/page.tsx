"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Descriptions, Tag, Button, Spin, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import request from '@/lib/api'
import { getErrorMessage } from '@/lib/api'

interface Hazard {
  id: string
  content: string | null
  description: string | null
  location: string | null
  category: string | null
  inspection_method: string | null
  inspector: string | null
  inspection_date: string | null
  judgment_basis: string | null
  violation_clause: string | null
  is_rectified: string | null
  rectification_date: string | null
  rectification_responsible: string | null
  rectification_measures: string | null
  report_remarks: string | null
  reporting_unit: string | null
  status: string
  current_task_id: string | null
  review_count: number
  created_at: string | null
  updated_at: string | null
  enterprise_name?: string | null
  enterprise_credit_code?: string | null
  enterprise_region?: string | null
  enterprise_address?: string | null
  enterprise_contact_person?: string | null
  enterprise_industry_sector?: string | null
  enterprise_enterprise_type?: string | null
  batch_name?: string | null
  batch_reporting_unit?: string | null
}

export default function HazardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [hazard, setHazard] = useState<Hazard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    const controller = new AbortController()
    const load = async () => {
      try {
        const r = (await request.get(`/hazards/${id}`, {
          signal: controller.signal,
        })) as Hazard
        if (!aborted) setHazard(r)
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
        message.error(getErrorMessage(err) || '加载失败')
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [id])

  if (loading) return <Spin size="large" />
  if (!hazard) return <div>隐患不存在</div>

  const statusText = hazard.status === 'pending' ? '待复核' : hazard.status === 'passed' ? '已通过' : '未通过'
  const statusColor = hazard.status === 'pending' ? 'gold' : hazard.status === 'passed' ? 'green' : 'red'

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/hazards')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card title="隐患详情">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="ID">{hazard.id}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColor}>{statusText}</Tag></Descriptions.Item>
          <Descriptions.Item label="企业">{hazard.enterprise_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="统一社会信用代码">{hazard.enterprise_credit_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="批次">{hazard.batch_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="上报单位">{hazard.reporting_unit || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患分类">{hazard.category || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患位置">{hazard.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查方式">{hazard.inspection_method || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查人">{hazard.inspector || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查时间">{hazard.inspection_date ? new Date(hazard.inspection_date).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="是否整改">{hazard.is_rectified || '-'}</Descriptions.Item>
          <Descriptions.Item label="整改完成时间">{hazard.rectification_date ? new Date(hazard.rectification_date).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="整改责任人">{hazard.rectification_responsible || '-'}</Descriptions.Item>
          <Descriptions.Item label="复核次数">{hazard.review_count}</Descriptions.Item>
          <Descriptions.Item label="当前复核任务">{hazard.current_task_id || '-'}</Descriptions.Item>
        </Descriptions>
        <Descriptions bordered column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="隐患描述">{hazard.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="判定依据">{hazard.judgment_basis || '-'}</Descriptions.Item>
          <Descriptions.Item label="违反条款">{hazard.violation_clause || '-'}</Descriptions.Item>
          <Descriptions.Item label="整改措施">{hazard.rectification_measures || '-'}</Descriptions.Item>
          <Descriptions.Item label="举报备注">{hazard.report_remarks || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
