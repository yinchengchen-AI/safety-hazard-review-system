"use client"
import { useCallback, useEffect, useState } from 'react'
import { Table, Tag, Button, message } from 'antd'
import { useRouter } from 'next/navigation'
import request, { getErrorMessage } from '@/lib/api'
import dayjs from 'dayjs'

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

interface BatchListResponse {
  items: Batch[]
  total: number
  page: number
  page_size: number
}

export default function BatchesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Batch[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const load = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/batches', {
        params: { page, page_size: pageSize },
        signal: controller?.signal,
      })) as BatchListResponse
      setItems(r.items)
      setTotal(r.total)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [load])

  return (
    <div>
      <div className="dashboard-toolbar">
        <Button type="primary" onClick={() => router.push('/batches/import')}>新建导入</Button>
      </div>
      <div className="dashboard-table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          size="middle"
          scroll={{ x: 820 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '文件', dataIndex: 'file_name', width: 200 },
            { title: '导入人', dataIndex: 'creator_username', width: 120 },
            {
              title: '成功 / 失败', width: 140,
              render: (_: unknown, r: Batch) => (
                <span>
                  <Tag color="green">{r.success_count}</Tag>
                  {' / '}
                  <Tag color="red">{r.fail_count}</Tag>
                </span>
              ),
            },
            { title: '可用隐患', dataIndex: 'available_hazard_count', width: 100 },
            { title: '导入时间', dataIndex: 'import_time', width: 180, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
          ]}
        />
      </div>
    </div>
  )
}
