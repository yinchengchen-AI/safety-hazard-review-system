"use client"

import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Tag,
  Input,
  Select,
  DatePicker,
  Button,
  message,
} from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import request, { getErrorMessage } from '@/lib/api'

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
  detail: Record<string, unknown> | null
  user_agent: string | null
}

interface Filters {
  action: string
  target_type: string | undefined
  user_id: string
  start_date: Dayjs | null
  end_date: Dayjs | null
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<Filters>({
    action: '',
    target_type: undefined,
    user_id: '',
    start_date: null,
    end_date: null,
  })

  const load = useCallback(
    async (controller?: AbortController) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, page_size: pageSize }
        if (filters.action) params.action = filters.action
        if (filters.target_type) params.target_type = filters.target_type
        if (filters.user_id) params.user_id = filters.user_id
        if (filters.start_date) params.start_date = filters.start_date.format('YYYY-MM-DD')
        if (filters.end_date) params.end_date = filters.end_date.format('YYYY-MM-DD')
        const r = (await request.get('/audit-logs', {
          params,
          signal: controller?.signal,
        })) as { items: AuditLog[]; total: number }
        setItems(r.items)
        setTotal(r.total)
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
        message.error(getErrorMessage(err) || '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, filters],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [load])

  const reset = () => {
    setFilters({
      action: '',
      target_type: undefined,
      user_id: '',
      start_date: null,
      end_date: null,
    })
    setPage(1)
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        <Input
          allowClear
          placeholder="操作 (action)"
          style={{ width: 220 }}
          value={filters.action}
          onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1) }}
          prefix={<SearchOutlined />}
        />
        <Select
          allowClear
          placeholder="对象类型"
          style={{ width: 160 }}
          value={filters.target_type}
          onChange={(v) => { setFilters({ ...filters, target_type: v }); setPage(1) }}
          options={[
            { value: 'auth', label: '认证' },
            { value: 'user', label: '用户' },
            { value: 'enterprise', label: '企业' },
            { value: 'hazard', label: '隐患' },
            { value: 'batch', label: '批次' },
            { value: 'review_task', label: '复核任务' },
            { value: 'report', label: '报告' },
            { value: 'photo', label: '照片' },
            { value: 'notification', label: '通知' },
          ]}
        />
        <Input
          allowClear
          placeholder="用户 ID"
          style={{ width: 220 }}
          value={filters.user_id}
          onChange={(e) => { setFilters({ ...filters, user_id: e.target.value }); setPage(1) }}
        />
        <DatePicker
          placeholder="起始日期"
          value={filters.start_date}
          onChange={(d) => { setFilters({ ...filters, start_date: d }); setPage(1) }}
          format="YYYY-MM-DD"
        />
        <DatePicker
          placeholder="结束日期"
          value={filters.end_date}
          onChange={(d) => { setFilters({ ...filters, end_date: d }); setPage(1) }}
          format="YYYY-MM-DD"
        />
        <Button icon={<ReloadOutlined />} onClick={reset}>重置</Button>
      </div>
      <div className="dashboard-table-wrap">
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
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1200 }}
          columns={[
            { title: '时间', dataIndex: 'created_at', width: 170, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
            { title: '操作', dataIndex: 'action', width: 220, render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: '对象', dataIndex: 'target_type', width: 110, render: (v: string) => <Tag>{v}</Tag> },
            { title: '对象 ID', dataIndex: 'target_id', width: 90, render: (v: string | null) => v ? v.slice(0, 8) : '-' },
            { title: '用户 ID', dataIndex: 'user_id', width: 90, render: (v: string | null) => v ? v.slice(0, 8) : '-' },
            { title: '方法', dataIndex: 'method', width: 70 },
            { title: '状态', dataIndex: 'status_code', width: 70, render: (v: number | null) => v == null ? '-' : <Tag color={v >= 500 ? 'red' : v >= 400 ? 'orange' : 'green'}>{v}</Tag> },
            { title: '路径', dataIndex: 'path', ellipsis: true, width: 220 },
            { title: 'IP', dataIndex: 'ip_address', width: 130, render: (v: string | null) => v ?? '-' },
            {
              title: '详情', dataIndex: 'detail', width: 240,
              render: (v: Record<string, unknown> | null) =>
                v ? <code style={{ fontSize: 12 }}>{JSON.stringify(v).slice(0, 200)}</code> : '-',
            },
          ]}
        />
      </div>
    </div>
  )
}
