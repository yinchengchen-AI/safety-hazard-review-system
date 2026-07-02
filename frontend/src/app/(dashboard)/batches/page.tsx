"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, message } from 'antd'
import { useRouter } from 'next/navigation'
import request from '@/lib/api'

interface Batch {
  id: string
  name: string
  file_name: string | null
  import_time: string | null
  total_count: number
  success_count: number
  fail_count: number
  creator_username?: string | null
  available_hazard_count?: number
}

export default function BatchesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/batches?page=1&page_size=20')) as Batch[]
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
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => router.push('/batches/import')}>新建导入</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '文件', dataIndex: 'file_name', width: 200 },
          { title: '导入人', dataIndex: 'creator_username', width: 120 },
          {
            title: '成功 / 失败', width: 140,
            render: (_: any, r: Batch) => (
              <span>
                <Tag color="green">{r.success_count}</Tag>
                {' / '}
                <Tag color="red">{r.fail_count}</Tag>
              </span>
            ),
          },
          { title: '可用隐患', dataIndex: 'available_hazard_count', width: 100 },
          { title: '导入时间', dataIndex: 'import_time', width: 180, render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
        ]}
      />
    </div>
  )
}
