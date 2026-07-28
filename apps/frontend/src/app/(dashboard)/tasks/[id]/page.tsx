"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
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
  Upload,
  Image,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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

interface ReportStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  pdf_path: string | null
  word_path: string | null
  error_message: string | null
  generated_at: string | null
}

interface PhotoUploadResponse {
  temp_token: string
  original_url: string
  thumbnail_url: string
  width: number
  height: number
  file_size: number
}

interface PhotoItem {
  id: string
  task_hazard_id: string
  original_url: string
  thumbnail_url: string
  created_at: string | null
}

const REPORT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待生成', color: 'gold' },
  processing: { text: '生成中', color: 'processing' },
  completed: { text: '已生成', color: 'green' },
  failed: { text: '生成失败', color: 'red' },
}

const POLL_INTERVAL_MS = 4000
const MAX_PHOTO_SIZE = 10 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png']

/** 已绑定照片的缩略图墙：展开行时才拉取（签名 URL TTL 900s，不做全局定时刷新） */
function HazardPhotos({ taskHazardId, refreshKey }: { taskHazardId: string; refreshKey: number }) {
  const [photos, setPhotos] = useState<PhotoItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchPhotos = async () => {
      try {
        const r = (await request.get('/photos', { params: { task_hazard_id: taskHazardId } })) as PhotoItem[]
        if (!cancelled) setPhotos(r)
      } catch {
        if (!cancelled) setPhotos([])
      }
    }
    fetchPhotos()
    return () => { cancelled = true }
  }, [taskHazardId, refreshKey])

  if (!photos) return <Spin size="small" />
  if (photos.length === 0) return <span style={{ color: '#999' }}>暂无照片</span>
  return (
    <Image.PreviewGroup>
      <Space wrap size={8}>
        {photos.map((p) => (
          <Image
            key={p.id}
            src={p.thumbnail_url}
            preview={{ src: p.original_url }}
            width={72}
            height={72}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            alt="复核照片"
          />
        ))}
      </Space>
    </Image.PreviewGroup>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<TaskHazard | null>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [photoList, setPhotoList] = useState<UploadFile<PhotoUploadResponse>[]>([])
  const [report, setReport] = useState<ReportStatus | null>(null)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState<'pdf' | 'word' | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
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

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    setGenerating(false)
  }, [])

  const fetchReportStatus = useCallback(async (): Promise<ReportStatus | null> => {
    try {
      const r = (await request.get(`/reports/${id}/status`)) as ReportStatus
      setReport(r)
      return r
    } catch {
      // 报告尚未创建时后端返回 404，属正常情况
      return null
    }
  }, [id])

  const startPolling = useCallback(() => {
    if (pollTimer.current) return
    setGenerating(true)
    pollTimer.current = setInterval(async () => {
      const r = await fetchReportStatus()
      if (!r) return
      if (r.status === 'completed') {
        stopPolling()
        message.success('报告生成完成')
        load()
      } else if (r.status === 'failed') {
        stopPolling()
        message.error(r.error_message || '报告生成失败')
        load()
      }
    }, POLL_INTERVAL_MS)
  }, [fetchReportStatus, stopPolling, load])

  // 页面卸载时清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  // 初始化：若报告正在生成中，恢复轮询；已有报告则同步一次状态（拿 error_message 等）
  useEffect(() => {
    if (!task?.report_status) return
    if (task.report_status === 'pending' || task.report_status === 'processing') {
      startPolling()
    } else {
      fetchReportStatus()
    }
  }, [task?.report_status, startPolling, fetchReportStatus])

  const generateReport = async () => {
    setGenerating(true)
    try {
      await request.post(`/reports/${id}/generate`)
      message.success('报告生成任务已提交')
      await fetchReportStatus()
      startPolling()
    } catch (err: any) {
      setGenerating(false)
      message.error(getErrorMessage(err) || '报告生成失败')
    }
  }

  const handleComplete = async () => {
    Modal.confirm({
      title: '确认完成该复核任务？',
      content: '完成后任务将被锁定，所有隐患不可再复核或修改，请确认已全部复核完毕。',
      okText: '确认完成',
      cancelText: '暂不完成',
      onOk: async () => {
        try {
          await request.post(`/review-tasks/${id}/complete`)
          message.success('任务已完成')
          load()
        } catch (err: any) {
          message.error(getErrorMessage(err) || '操作失败')
        }
      },
    })
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
    setPhotoList([])
    form.setFieldsValue({
      conclusion: th.conclusion ?? '',
      status_in_task: (th.status_in_task as 'pending' | 'passed' | 'failed') ?? 'passed',
    })
    setReviewOpen(true)
  }

  const closeReview = () => {
    setReviewOpen(false)
    setReviewTarget(null)
    setPhotoList([])
    form.resetFields()
  }

  const submitReview = async () => {
    if (!reviewTarget) return
    if (photoList.some((f) => f.status === 'uploading')) {
      message.warning('照片仍在上传中，请稍候再提交')
      return
    }
    if (photoList.some((f) => f.status === 'error')) {
      message.warning('存在上传失败的照片，请移除后再提交')
      return
    }
    try {
      const v = await form.validateFields()
      const tokens = photoList
        .filter((f) => f.status === 'done' && f.response?.temp_token)
        .map((f) => f.response!.temp_token)
      setReviewSubmitting(true)
      await request.post(`/review-tasks/${id}/hazards/${reviewTarget.hazard_id}/review`, {
        ...v,
        ...(tokens.length > 0 ? { photo_tokens: tokens } : {}),
      })
      message.success('复核已提交')
      closeReview()
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '提交失败')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const downloadReport = async (format: 'pdf' | 'word') => {
    setDownloading(format)
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
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      message.error(getErrorMessage(err) || '下载失败')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <Spin size="large" />
  if (!task) return <div>任务不存在</div>

  const statusText = task.status === 'pending' ? '待复核' : task.status === 'completed' ? '已完成' : '已取消'
  const statusColor = task.status === 'pending' ? 'gold' : task.status === 'completed' ? 'green' : 'red'
  const canReview = task.status === 'pending'
  const effectiveReportStatus = report?.status ?? task.report_status
  const reportMeta = effectiveReportStatus ? REPORT_STATUS_MAP[effectiveReportStatus] : null

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/tasks')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card
        title="任务信息"
        extra={
          <Space wrap className="task-detail-actions">
            {task.status === 'pending' && (
              <Button danger onClick={handleCancel}>取消任务</Button>
            )}
            {canReview && task.reviewed_count === task.hazard_count && task.hazard_count > 0 && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>
                完成任务
              </Button>
            )}
            <Button
              icon={<FileTextOutlined />}
              loading={generating}
              onClick={generateReport}
              disabled={generating}
            >
              {generating ? '生成中…' : effectiveReportStatus === 'completed' ? '重新生成报告' : '生成报告'}
            </Button>
          </Space>
        }
      >
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColor}>{statusText}</Tag></Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creator_username ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="复核进度">{task.reviewed_count} / {task.hazard_count}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at ? dayjs(task.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{task.completed_at ? dayjs(task.completed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="报告" span={{ xs: 1, sm: 2 }}>
            {effectiveReportStatus ? (
              <Space wrap>
                <Tag color={reportMeta?.color ?? 'blue'}>{reportMeta?.text ?? effectiveReportStatus}</Tag>
                {effectiveReportStatus === 'completed' && (
                  <>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={downloading === 'pdf'}
                      onClick={() => downloadReport('pdf')}
                    >
                      下载 PDF
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={downloading === 'word'}
                      onClick={() => downloadReport('word')}
                    >
                      下载 Word
                    </Button>
                    {report?.generated_at && (
                      <span style={{ color: '#999', fontSize: 12 }}>
                        生成于 {dayjs(report.generated_at).format('YYYY-MM-DD HH:mm:ss')}
                      </span>
                    )}
                  </>
                )}
                {effectiveReportStatus === 'failed' && (
                  <span style={{ color: '#ff4d4f' }}>{report?.error_message || '报告生成失败，可重试'}</span>
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
            scroll={{ x: 980 }}
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (r: TaskHazard) => (
                <HazardPhotos taskHazardId={r.task_hazard_id} refreshKey={task.reviewed_count} />
              ),
            }}
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
        onCancel={closeReview}
        onOk={submitReview}
        okText="提交"
        cancelText="取消"
        confirmLoading={reviewSubmitting}
        width="min(560px, calc(100vw - 32px))"
        destroyOnHidden
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
          <Form.Item label="复核照片" extra="仅支持 JPEG / PNG，单张不超过 10MB，可多选">
            <Upload
              listType="picture-card"
              accept="image/jpeg,image/png"
              multiple
              fileList={photoList}
              beforeUpload={(file) => {
                if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
                  message.error('仅支持 JPEG / PNG 图片')
                  return Upload.LIST_IGNORE
                }
                if (file.size > MAX_PHOTO_SIZE) {
                  message.error('图片大小不能超过 10MB')
                  return Upload.LIST_IGNORE
                }
                return true
              }}
              customRequest={async (options) => {
                const fd = new FormData()
                fd.append('file', options.file as File)
                try {
                  const r = (await request.post('/photos/upload', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  })) as PhotoUploadResponse
                  options.onSuccess?.(r)
                } catch (err: any) {
                  message.error(getErrorMessage(err) || '照片上传失败')
                  options.onError?.(err instanceof Error ? err : new Error('上传失败'))
                }
              }}
              onChange={({ fileList }) => {
                setPhotoList(
                  fileList.map((f) =>
                    f.status === 'done' && f.response && !f.url
                      ? { ...f, url: f.response.thumbnail_url }
                      : f,
                  ),
                )
              }}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传照片</div>
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
