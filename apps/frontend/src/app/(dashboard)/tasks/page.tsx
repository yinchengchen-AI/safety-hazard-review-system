"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, message, Button, Modal, Form, Input, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import request, { getErrorMessage } from '@/lib/api'
import dayjs from 'dayjs'

interface Task {
  id: string
  name: string
  creator_id: string
  status: string
  created_at: string | null
  completed_at: string | null
  creator_username?: string | null
  hazard_count: number
  reviewed_count: number
  report_status?: string | null
}

interface Batch {
  id: string
  name: string
  total_count: number
  success_count: number
  available_hazard_count: number
  creator_username: string | null
  import_time: string | null
}

const REPORT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待生成', color: 'gold' },
  processing: { text: '生成中', color: 'processing' },
  completed: { text: '已生成', color: 'green' },
  failed: { text: '生成失败', color: 'red' },
}

interface TaskListResponse {
  items: Task[]
  total: number
  page: number
  page_size: number
}

interface BatchListResponse {
  items: Batch[]
  total: number
  page: number
  page_size: number
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待复核' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

export default function TasksPage() {
  const router = useRouter()
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [form] = Form.useForm<{ name: string; batch_ids: string[] }>()

  const load = async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/review-tasks', {
        params: {
          page,
          page_size: pageSize,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        signal: controller?.signal,
      })) as TaskListResponse
      setItems(r.items)
      setTotal(r.total)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter])

  const openCreate = async () => {
    setCreateOpen(true)
    setBatchesLoading(true)
    try {
      const r = (await request.get('/batches', { params: { page: 1, page_size: 100 } })) as BatchListResponse
      setBatches(r.items)
    } catch (err: any) {
      message.error(getErrorMessage(err) || '批次列表加载失败')
    } finally {
      setBatchesLoading(false)
    }
  }

  const submitCreate = async () => {
    try {
      const v = await form.validateFields()
      setCreating(true)
      const created = (await request.post('/review-tasks', {
        name: v.name,
        batch_ids: v.batch_ids,
      })) as Task
      message.success('任务创建成功')
      setCreateOpen(false)
      form.resetFields()
      load()
      router.push(`/tasks/${created.id}`)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        <Select
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          options={STATUS_FILTER_OPTIONS}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建任务
        </Button>
      </div>
      <div className="dashboard-table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          size="middle"
          scroll={{ x: 760 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={(p) => {
            setPage(p.current ?? 1)
            setPageSize(p.pageSize ?? 20)
          }}
          onRow={(record) => ({ onClick: () => router.push(`/tasks/${record.id}`) })}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '创建人', dataIndex: 'creator_username', width: 120 },
            {
              title: '状态', dataIndex: 'status', width: 100,
              render: (s: string) => {
                const color = s === 'pending' ? 'gold' : s === 'completed' ? 'green' : 'red'
                const text = s === 'pending' ? '待复核' : s === 'completed' ? '已完成' : '已取消'
                return <Tag color={color}>{text}</Tag>
              },
            },
            { title: '隐患 / 复核', width: 120, render: (_: unknown, r: Task) => `${r.reviewed_count} / ${r.hazard_count}` },
            {
              title: '报告', dataIndex: 'report_status', width: 100,
              render: (s: string | null) => {
                if (!s) return <Tag>未生成</Tag>
                const m = REPORT_STATUS_MAP[s] ?? { text: s, color: 'blue' }
                return <Tag color={m.color}>{m.text}</Tag>
              },
            },
            { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
          ]}
        />
      </div>

      <Modal
        title="新建复核任务"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={submitCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        width="min(520px, calc(100vw - 32px))"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, min: 1, max: 200, message: '请填写任务名称（1-200 字）' }]}
          >
            <Input maxLength={200} showCount placeholder="例如：2026 年 7 月隐患复核" />
          </Form.Item>
          <Form.Item
            name="batch_ids"
            label="选择批次"
            extra="任务将包含所选批次中尚未分配复核任务的隐患"
            rules={[{ required: true, message: '请至少选择一个批次' }]}
          >
            <Select
              mode="multiple"
              loading={batchesLoading}
              placeholder="请选择批次（可多选）"
              optionFilterProp="label"
              options={batches.map((b) => ({
                value: b.id,
                label: `${b.name}（可用 ${b.available_hazard_count} 条）`,
                disabled: b.available_hazard_count === 0,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
