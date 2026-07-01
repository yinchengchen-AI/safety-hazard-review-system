"use client"
import { Button, Upload, message, Card, Space, Typography } from 'antd'
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import request from '@/lib/api'

const { Dragger } = Upload

export default function BatchImportPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const onDownloadTemplate = async () => {
    try {
      const res = await request.get('/batches/template', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res as any]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'hazard_batch_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err: any) {
      message.error('模板下载失败')
    }
  }

  const props = {
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async (options: any) => {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', options.file)
        const r = await request.post('/batches/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setResult(r)
        message.success('导入完成')
        options.onSuccess?.(r)
      } catch (err: any) {
        message.error(err?.detail || '导入失败')
        options.onError?.(err)
      } finally {
        setUploading(false)
      }
    },
  }

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<DownloadOutlined />} onClick={onDownloadTemplate}>下载导入模板</Button>
        </Space>
        <Dragger {...props} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 Excel / CSV 文件到此区域上传</p>
          <p className="ant-upload-hint">仅支持 .xlsx / .xls / .csv，单条记录不超过 10MB</p>
        </Dragger>
      </Card>
      {result && (
        <Card style={{ marginTop: 16 }} title="导入结果">
          <p>批次 ID: {result.batch?.id}</p>
          <p>成功: {result.success_count} | 失败: {result.fail_count}</p>
          {result.errors?.length > 0 && (
            <div>
              <Typography.Title level={5}>错误明细</Typography.Title>
              <ul>
                {result.errors.map((e: any, i: number) => <li key={i}>第 {e.row_index} 行: {e.reason}</li>)}
              </ul>
            </div>
          )}
          <Button onClick={() => router.push('/batches')} type="primary" style={{ marginTop: 16 }}>返回列表</Button>
        </Card>
      )}
    </div>
  )
}
