import { useEffect, useState } from 'react'
import { Table, Button, Space, Popconfirm, message, Pagination } from 'antd'
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
    { title: '成功数', dataIndex: 'success_count', key: 'success_count' },
    { title: '失败数', dataIndex: 'fail_count', key: 'fail_count' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Batch) => (
        <Space>
          <Button type="link" onClick={() => handleDownloadErrors(record)}>
            下载失败明细
          </Button>
          <Button type="link" onClick={() => handleDownloadFile(record)}>
            下载原始文件
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={batches}
        columns={columns}
        pagination={false}
      />
      <Pagination
        style={{ marginTop: 16, textAlign: 'right' }}
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={(p, ps) => {
          setPage(p)
          if (ps) setPageSize(ps)
        }}
      />
    </div>
  )
}

export default BatchHistory
