"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, message } from 'antd'
import request, { getErrorMessage } from '@/lib/api'

interface Notif {
  id: string
  type: string
  title: string
  related_type: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)

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

  const markAll = async () => {
    try {
      await request.post('/notifications/read-all')
      message.success('已全部标记为已读')
      load()
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
          scroll={{ x: 620 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type', width: 120, render: (v: string) => <Tag>{v}</Tag> },
            { title: '已读', dataIndex: 'is_read', width: 80, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag> },
            { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          ]}
        />
      </div>
    </div>
  )
}
