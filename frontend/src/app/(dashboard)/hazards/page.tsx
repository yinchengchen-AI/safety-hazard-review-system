"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Space, Button, message, Input, Select } from 'antd'
import { useRouter } from 'next/navigation'
import request from '@/lib/api'

interface Hazard {
  id: string
  content: string | null
  description: string | null
  location: string | null
  status: string
  is_rectified: string | null
  enterprise_name?: string | null
  batch_name?: string | null
  review_count: number
  created_at: string | null
}

export default function HazardsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Hazard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<string | undefined>()

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/hazards', {
        params: { page, page_size: pageSize, ...(status ? { status } : {}) },
      })) as { items: Hazard[]; total: number }
      setItems(r.items)
      setTotal(r.total)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load() }, [page, pageSize, status])

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={[
            { value: 'pending', label: '待复核' },
            { value: 'passed', label: '已通过' },
            { value: 'failed', label: '未通过' },
          ]}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
        onRow={(record) => ({ onClick: () => router.push(`/hazards/${record.id}`) })}
        columns={[
          { title: '编号', dataIndex: 'id', width: 90, render: (v: string) => v.slice(0, 8) },
          { title: '描述', dataIndex: 'content', ellipsis: true },
          { title: '位置', dataIndex: 'location', width: 140 },
          { title: '企业', dataIndex: 'enterprise_name', width: 160, ellipsis: true },
          { title: '批次', dataIndex: 'batch_name', width: 140 },
          {
            title: '状态', dataIndex: 'status', width: 100,
            render: (s: string) => {
              const color = s === 'pending' ? 'gold' : s === 'passed' ? 'green' : 'red'
              const text = s === 'pending' ? '待复核' : s === 'passed' ? '已通过' : '未通过'
              return <Tag color={color}>{text}</Tag>
            },
          },
          { title: '复核次数', dataIndex: 'review_count', width: 100 },
        ]}
      />
    </div>
  )
}
