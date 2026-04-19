import { useEffect, useState } from 'react'
import { Table, Button, Space, Popconfirm, message, Pagination } from 'antd'
import { HistoryOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons'
import { getBatches, deleteBatch, downloadBatchFile, getImportErrors } from '../../api/batch'
import * as XLSX from 'xlsx'

interface Batch {
  id: string
  name: string
  import_time: string
  file_name: string | null
  total_count: number
  success_count: number
  fail_count: number
  creator_username?: string
}

function BatchHistory() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res: any = await getBatches({ page, page_size: pageSize })
      const list: Batch[] = Array.isArray(res) ? res : res?.items || res?.data || []
      const totalCount: number = Array.isArray(res) ? res.length : res?.total ?? list.length
      setBatches(list)
      setTotal(totalCount)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, pageSize])

  const handleDelete = async (id: string) => {
    try {
      await deleteBatch(id)
      message.success('删除成功')
      fetchData()
    } catch {
      message.error('删除失败')
    }
  }

  const handleDownloadFile = async (batch: Batch) => {
    try {
      const blob = await downloadBatchFile(batch.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = batch.file_name || 'download'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('下载失败')
    }
  }

  const handleDownloadErrors = async (batch: Batch) => {
    try {
      const errors: any[] = await getImportErrors(batch.id)
      if (errors.length === 0) {
        message.info('该批次无失败明细')
        return
      }
      const ws = XLSX.utils.json_to_sheet(
        errors.map((e: any) => ({
          行号: e.row_index,
          原始数据: e.raw_data,
          错误原因: e.reason,
        }))
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '失败明细')
      XLSX.writeFile(wb, `${batch.name}_失败明细.xlsx`)
    } catch {
      message.error('下载失败')
    }
  }

  const columns = [
    { title: '批次名称', dataIndex: 'name', key: 'name' },
    { title: '导入时间', dataIndex: 'import_time', key: 'import_time' },
    { title: '导入人', dataIndex: 'creator_username', key: 'creator_username' },
    { title: '总条数', dataIndex: 'total_count', key: 'total_count' },
    {
      title: '成功数',
      dataIndex: 'success_count',
      key: 'success_count',
      render: (v: number) => <span style={{ color: 'var(--success)', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '失败数',
      dataIndex: 'fail_count',
      key: 'fail_count',
      render: (v: number) => (
        <span style={{ color: v > 0 ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Batch) => (
        <Space>
          <Button
            type="link"
            icon={<FileExcelOutlined />}
            onClick={() => handleDownloadErrors(record)}
            style={{ color: 'var(--primary)' }}
          >
            下载失败明细
          </Button>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadFile(record)}
            style={{ color: 'var(--cyan)' }}
          >
            下载原始文件
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div
        className="app-card animate-fade-in-up delay-0"
        style={{
          marginBottom: 24,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          <HistoryOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>导入历史</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>查看和管理历史导入记录</p>
        </div>
      </div>

      <div className="app-card animate-fade-in-up delay-1" style={{ marginBottom: 24 }}>
        <div style={{ padding: 20 }}>
          <div className="app-table">
            <Table
              rowKey="id"
              loading={loading}
              dataSource={batches}
              columns={columns}
              pagination={false}
            />
          </div>
          <Pagination
            style={{ marginTop: 20, textAlign: 'right' }}
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            pageSizeOptions={[10, 20, 50]}
            onChange={(p, ps) => {
              setPage(p)
              if (ps) setPageSize(ps)
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default BatchHistory
