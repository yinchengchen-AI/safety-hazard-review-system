"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, message } from 'antd'
import dayjs from 'dayjs'
import request, { getErrorMessage } from '@/lib/api'
import { useNotificationStore } from '@/lib/notificationStore'

interface Notif {
  id: string
  type: string
  title: string
  related_type: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

const TYPE_MAP: Record<string, string> = {
  task_created: '任务创建',
  task_completed: '任务完成',
  task_cancelled: '任务取消',
  hazard_reviewed: '隐患复核',
  report_completed: '报告完成',
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)

  const load = async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/notifications?page=1&page_size=50', { signal: controller?.signal })) as { items: Notif[]; total: number }
      setItems(r.items)
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
  }, [])

  const markOne = async (id: string) => {
    try {
      await markRead(id)
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      message.success('已标记为已读')
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  const markAll = async () => {
    try {
      await markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      message.success('已全部标记为已读')
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        <Button onClick={markAll}>全部已读</Button>
      </div>
      <div className="dashboard-table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          size="middle"
          scroll={{ x: 720 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type', width: 120, render: (v: string) => <Tag>{TYPE_MAP[v] ?? v}</Tag> },
            { title: '已读', dataIndex: 'is_read', width: 80, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag> },
            { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
            {
              title: '操作', key: 'action', width: 100,
              render: (_: unknown, record: Notif) =>
                record.is_read ? null : (
                  <Button type="link" size="small" onClick={() => markOne(record.id)}>标为已读</Button>
                ),
            },
          ]}
        />
      </div>
    </div>
  )
}
