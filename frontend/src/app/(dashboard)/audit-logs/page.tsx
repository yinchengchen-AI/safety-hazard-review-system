"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Input, message } from 'antd'
import { useUserStore } from '@/lib/userStore'
import { useRouter } from 'next/navigation'
import request from '@/lib/api'

interface AuditLog {
  id: string
  action: string
  target_type: string
  target_id: string | null
  user_id: string | null
  ip_address: string | null
  method: string | null
  path: string | null
  status_code: number | null
  created_at: string
}

export default function AuditLogsPage() {
  const user = useUserStore((s) => s.user)
  const router = useRouter()
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState('')

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, router])

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/audit-logs', { params: { page: 1, page_size: 50, ...(action ? { action } : {}) } })) as { items: AuditLog[]; total: number }
      setItems(r.items)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (user?.role === 'admin') load() }, [user, action])

  return (
    <div>
      <Input.Search
        allowClear
        placeholder="按动作过滤"
        style={{ width: 240, marginBottom: 16 }}
        onSearch={(v) => setAction(v)}
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '动作', dataIndex: 'action', width: 180 },
          { title: '目标', dataIndex: 'target_type', width: 120, render: (v: string) => <Tag>{v}</Tag> },
          { title: 'IP', dataIndex: 'ip_address', width: 140 },
          { title: '方法', dataIndex: 'method', width: 80 },
          { title: '路径', dataIndex: 'path', ellipsis: true },
          { title: '状态', dataIndex: 'status_code', width: 80 },
          { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
        ]}
      />
    </div>
  )
}
