"use client"

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  message,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Radio,
  Empty,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import request, { getErrorMessage } from '@/lib/api'

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
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<TaskHazard | null>(null)
  const [form] = Form.useForm<{ conclusion: string; status_in_task: 'pending' | 'passed' | 'failed' }>()

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
    Modal.confirm({
      title: '确认取消该复核任务？',
      content: '取消后所有已复核的隐患状态将回退为待复核，current_task_id 也会被清空。',
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '不取消',
      onOk: async () => {
        try {
          await request.post(`/review-tasks/${id}/cancel`)
          message.success('任务已取消')
          load()
        } catch (err: any) {
          message.error(getErrorMessage(err) || '操作失败')
        }
      },
    })
  }

  const openReview = (th: TaskHazard) => {
    setReviewTarget(th)
    form.setFieldsValue({
      conclusion: th.conclusion ?? '',
      status_in_task: (th.status_in_task as 'pending' | 'passed' | 'failed') ?? 'passed',
    })
    setReviewOpen(true)
  }

  const submitReview = async () => {
    if (!reviewTarget) return
    try {
      const v = await form.validateFields()
      await request.post(`/review-tasks/${id}/hazards/${reviewTarget.hazard_id}/review`, v)
      message.success('复核已提交')
      setReviewOpen(false)
      setReviewTarget(null)
      form.resetFields()
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '提交失败')
    }
  }

  const downloadReport = async (format: 'pdf' | 'word') => {
    try {
      const res = await request.get(`/reports/${id}/download?format=${format}`, { responseType: 'blob' })
      const ext = format === 'pdf' ? 'pdf' : 'docx'
      const url = window.URL.createObjectURL(new Blob([res as any]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `report_${id}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '下载失败')
    }
  }

  if (loading) return <Spin size="large" />
  if (!task) return <div>任务不存在</div>

  const statusText = task.status === 'pending' ? '待复核' : task.status === 'completed' ? '已完成' : '已取消'
  const statusColor = task.status === 'pending' ? 'gold' : task.status === 'completed' ? 'green' : 'red'
  const canReview = task.status === 'pending'

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/tasks')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card
        title="任务信息"
        extra={
          <Space>
            {task.status === 'pending' && (
              <Button danger onClick={handleCancel}>取消任务</Button>
            )}
            {canReview && task.reviewed_count === task.hazard_count && task.hazard_count > 0 && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>
                完成任务
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColor}>{statusText}</Tag></Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creator_username ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="复核进度">{task.reviewed_count} / {task.hazard_count}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{task.completed_at ? new Date(task.completed_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="报告" span={2}>
            {task.report_status ? (
              <Space>
                <Tag color="blue">状态：{task.report_status}</Tag>
                {task.report_status === 'completed' && (
                  <>
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadReport('pdf')}>下载 PDF</Button>
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadReport('word')}>下载 Word</Button>
                  </>
                )}
              </Space>
            ) : (
              <Tag>未生成</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="隐患清单" style={{ marginTop: 16 }}>
        {task.hazards.length === 0 ? (
          <Empty description="该任务未包含隐患" />
        ) : (
          <Table
            rowKey="task_hazard_id"
            dataSource={task.hazards}
            size="middle"
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: '#', width: 50,
                render: (_: unknown, _r: TaskHazard, idx: number) => idx + 1,
              },
              { title: '企业', dataIndex: ['hazard', 'enterprise_name'], width: 160, ellipsis: true },
              { title: '隐患描述', dataIndex: ['hazard', 'content'], ellipsis: true },
              { title: '位置', dataIndex: ['hazard', 'location'], width: 160, ellipsis: true },
              {
                title: '是否整改', dataIndex: ['hazard', 'is_rectified'], width: 100,
                render: (v: string | null) => v ?? '-',
              },
              {
                title: '复核结果', dataIndex: 'status_in_task', width: 100,
                render: (s: string | null) => {
                  if (!s) return <Tag>未复核</Tag>
                  const color = s === 'passed' ? 'green' : s === 'failed' ? 'red' : 'gold'
                  const text = s === 'passed' ? '已通过' : s === 'failed' ? '未通过' : '待复核'
                  return <Tag color={color}>{text}</Tag>
                },
              },
              {
                title: '复核结论', dataIndex: 'conclusion', ellipsis: true,
                render: (v: string | null) => v ?? '-',
              },
              {
                title: '复核人', dataIndex: 'reviewer_username', width: 100,
                render: (v: string | null) => v ?? '-',
              },
              {
                title: '操作', width: 100, fixed: 'right',
                render: (_: unknown, r: TaskHazard) =>
                  canReview ? <Button type="link" onClick={() => openReview(r)}>{r.status_in_task ? '修改' : '复核'}</Button> : '-',
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title={reviewTarget ? `复核：${reviewTarget.hazard?.content ?? reviewTarget.hazard_id}` : '复核'}
        open={reviewOpen}
        onCancel={() => { setReviewOpen(false); setReviewTarget(null); form.resetFields() }}
        onOk={submitReview}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="status_in_task"
            label="复核结果"
            rules={[{ required: true, message: '请选择复核结果' }]}
          >
            <Radio.Group>
              <Radio.Button value="passed">通过</Radio.Button>
              <Radio.Button value="failed">不通过</Radio.Button>
              <Radio.Button value="pending">保留待复核</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="conclusion"
            label="复核结论"
            rules={[{ required: true, min: 1, max: 4000, message: '请填写复核结论（1-4000 字）' }]}
          >
            <Input.TextArea rows={4} maxLength={4000} showCount placeholder="请说明本次复核的依据和结论" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
