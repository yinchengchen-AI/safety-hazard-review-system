"use client"
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Descriptions, Tag, Button, Spin, message, Table, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import request from '@/lib/api'
import { getErrorMessage } from '@/lib/api'

interface TaskHazard {
  task_hazard_id: string
  hazard_id: string
  conclusion: string | null
  status_in_task: string | null
  reviewed_at: string | null
  reviewer_username: string | null
  hazard: {
    id: string
    content: string | null
    description: string | null
    location: string | null
    status: string
    is_rectified: string | null
    rectification_responsible: string | null
    rectification_measures: string | null
    reporting_unit: string | null
    enterprise_name: string | null
  } | null
}

interface TaskDetail {
  id: string
  name: string
  creator_id: string
  creator_username: string | null
  status: string
  created_at: string | null
  completed_at: string | null
  hazard_count: number
  reviewed_count: number
  report_status: string | null
  hazards: TaskHazard[]
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get(`/review-tasks/${id}`, {
        signal: controller?.signal,
      })) as TaskDetail
      setTask(r)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [load])

  const handleComplete = async () => {
    try {
      await request.post(`/review-tasks/${id}/complete`)
      message.success('任务已完成')
      load()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  const handleCancel = async () => {
    try {
      await request.post(`/review-tasks/${id}/cancel`)
      message.success('任务已取消')
      load()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  if (loading) return <Spin size="large" />
  if (!task) return <div>任务不存在</div>

  const statusText = task.status === 'pending' ? '待复核' : task.status === 'completed' ? '已完成' : '已取消'
  const statusColor = task.status === 'pending' ? 'gold' : task.status === 'completed' ? 'green' : 'red'

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/tasks')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card
        title="复核任务详情"
        extra={
          task.status === 'pending' ? (
            <Space>
              <Button onClick={handleCancel}>取消任务</Button>
              <Button type="primary" onClick={handleComplete}>完成任务</Button>
            </Space>
          ) : null
        }
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="ID">{task.id}</Descriptions.Item>
          <Descriptions.Item label="名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColor}>{statusText}</Tag></Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creator_username || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患数">{task.hazard_count}</Descriptions.Item>
          <Descriptions.Item label="已复核">{task.reviewed_count}</Descriptions.Item>
          <Descriptions.Item label="报告状态">{task.report_status ? <Tag color="blue">{task.report_status}</Tag> : <Tag>未生成</Tag>}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        </Descriptions>

        <Card title="隐患列表" style={{ marginTop: 24 }}>
          <Table
            rowKey="task_hazard_id"
            dataSource={task.hazards}
            pagination={false}
            columns={[
              { title: '企业', dataIndex: ['hazard', 'enterprise_name'], render: (v: string | null) => v || '-' },
              { title: '隐患描述', dataIndex: ['hazard', 'description'], ellipsis: true },
              { title: '位置', dataIndex: ['hazard', 'location'] },
              { title: '复核结论', dataIndex: 'conclusion', ellipsis: true },
              {
                title: '复核状态',
                dataIndex: 'status_in_task',
                render: (s: string | null) =>
                  s ? (
                    <Tag color={s === 'passed' ? 'green' : s === 'failed' ? 'red' : 'default'}>
                      {s === 'passed' ? '已通过' : s === 'failed' ? '未通过' : s}
                    </Tag>
                  ) : (
                    '-'
                  ),
              },
              { title: '复核人', dataIndex: 'reviewer_username' },
              {
                title: '操作',
                render: (_: any, r: TaskHazard) => (
                  <Button type="link" onClick={() => router.push(`/hazards/${r.hazard_id}`)}>查看隐患</Button>
                ),
              },
            ]}
          />
        </Card>
      </Card>
    </div>
  )
}
