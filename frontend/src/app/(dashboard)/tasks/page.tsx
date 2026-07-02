"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Space, Button, message } from 'antd'
import { useRouter } from 'next/navigation'
import request from '@/lib/api'

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

export default function TasksPage() {
  const router = useRouter()
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/review-tasks')) as Task[]
      setItems(r)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load() }, [])

  return (
    <div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
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
          { title: '隐患 / 复核', width: 120, render: (_: any, r: Task) => `${r.reviewed_count} / ${r.hazard_count}` },
          {
            title: '报告', dataIndex: 'report_status', width: 100,
            render: (s: string | null) => s ? <Tag color="blue">{s}</Tag> : <Tag>未生成</Tag>,
          },
          { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
        ]}
      />
    </div>
  )
}
