"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, message } from 'antd'
import request from '@/lib/api'

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

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/notifications?page=1&page_size=50')) as { items: Notif[]; total: number }
      setItems(r.items)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markAll = async () => {
    try {
      await request.post('/notifications/read-all')
      message.success('已全部标记为已读')
      load()
    } catch (err: any) {
      message.error(err?.detail || '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={markAll}>全部已读</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '标题', dataIndex: 'title' },
          { title: '类型', dataIndex: 'type', width: 120, render: (v: string) => <Tag>{v}</Tag> },
          { title: '已读', dataIndex: 'is_read', width: 80, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag> },
          { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
        ]}
      />
    </div>
  )
}
