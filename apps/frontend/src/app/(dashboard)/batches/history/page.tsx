"use client"

import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  message,
  Drawer,
  Descriptions,
  Empty,
  Spin,
  Typography,
} from 'antd'
import { DownloadOutlined, FileSearchOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import request, { getErrorMessage } from '@/lib/api'

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

interface ImportError {
  id: string
  batch_id: string
  row_index: number
  raw_data: string | null
  reason: string
}

export default function BatchesHistoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerBatch, setDrawerBatch] = useState<Batch | null>(null)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [errorsLoading, setErrorsLoading] = useState(false)

  const load = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/batches?page=1&page_size=50', {
        signal: controller?.signal,
      })) as Batch[]
      setItems(r)
    } catch (err) {
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [load])

  const openDrawer = async (b: Batch) => {
    setDrawerBatch(b)
    setDrawerOpen(true)
    setErrorsLoading(true)
    try {
      const r = (await request.get(`/batches/${b.id}/errors`)) as ImportError[]
      setErrors(r)
    } catch (err) {
      message.error(getErrorMessage(err) || '错误明细加载失败')
      setErrors([])
    } finally {
      setErrorsLoading(false)
    }
  }

  const downloadOriginal = async (b: Batch) => {
    try {
      const res = await request.get(`/batches/${b.id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res as any]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', b.file_name || `batch_${b.id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      message.error(getErrorMessage(err) || '下载失败')
    }
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        <Button onClick={() => router.push('/batches/import')}>新建导入</Button>
      </div>
      <div className="dashboard-table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          size="middle"
          scroll={{ x: 1060 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '批次名称', dataIndex: 'name' },
            { title: '文件名', dataIndex: 'file_name', ellipsis: true, width: 200 },
            { title: '导入人', dataIndex: 'creator_username', width: 120 },
            {
              title: '导入时间', dataIndex: 'import_time', width: 180,
              render: (v: string | null) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
            },
            {
              title: '成功 / 失败', width: 140,
              render: (_: unknown, r: Batch) => (
                <Space size={4}>
                  <Tag color="green">{r.success_count}</Tag>
                  <span>/</span>
                  <Tag color={r.fail_count > 0 ? 'red' : 'default'}>{r.fail_count}</Tag>
                </Space>
              ),
            },
            {
              title: '可复核隐患', dataIndex: 'available_hazard_count', width: 120,
              render: (n: number) => (n > 0 ? <Tag color="blue">{n}</Tag> : <Tag>0</Tag>),
            },
            {
              title: '操作', width: 200, fixed: 'right',
              render: (_: unknown, r: Batch) => (
                <Space wrap>
                  <Button
                    type="link"
                    icon={<FileSearchOutlined />}
                    disabled={r.fail_count === 0}
                    onClick={() => openDrawer(r)}
                  >
                    查看错误
                  </Button>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => downloadOriginal(r)}
                  >
                    下载原文件
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </div>
      <Drawer
        title={drawerBatch ? `批次错误明细 - ${drawerBatch.name}` : '错误明细'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width="min(720px, calc(100vw - 24px))"
      >
        {drawerBatch && (
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="批次 ID">{drawerBatch.id}</Descriptions.Item>
            <Descriptions.Item label="文件名">{drawerBatch.file_name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="导入人">{drawerBatch.creator_username ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="成功 / 失败">
              {drawerBatch.success_count} / {drawerBatch.fail_count}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Typography.Title level={5}>失败行</Typography.Title>
        {errorsLoading ? (
          <Spin />
        ) : errors.length === 0 ? (
          <Empty description="该批次没有失败行" />
        ) : (
          <Table
            rowKey="id"
            dataSource={errors}
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '行号', dataIndex: 'row_index', width: 80 },
              { title: '原因', dataIndex: 'reason' },
              {
                title: '原始数据', dataIndex: 'raw_data', width: 220,
                render: (v: string | null) =>
                  v ? (
                    <Typography.Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>
                      {v}
                    </Typography.Text>
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
