import { useState } from 'react'
import { Upload, Button, message, Table, Card, Space, Modal, Input } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import { importHazards, getImportErrors, previewImport, downloadTemplate } from '../../api/batch'
import { useNavigate } from 'react-router-dom'

interface PreviewItem {
  row_index: number
  enterprise_name: string | null
  credit_code: string | null
  region: string | null
  address: string | null
  contact_person: string | null
  industry_sector: string | null
  enterprise_type: string | null
  reporting_unit: string | null
  description: string | null
  content: string | null
  location: string | null
  category: string | null
  inspection_method: string | null
  inspector: string | null
  inspection_date: string | null
  judgment_basis: string | null
  violation_clause: string | null
  is_rectified: string | null
  rectification_date: string | null
  rectification_responsible: string | null
  rectification_measures: string | null
  report_remarks: string | null
  errors: string[]
}

function BatchImport() {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [errors, setErrors] = useState<any[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<{ total: number; items: PreviewItem[]; temp_token: string } | null>(null)
  const [batchName, setBatchName] = useState('')
  const navigate = useNavigate()

  const handlePreview = async () => {
    if (fileList.length === 0) {
      message.error('请选择文件')
      return
    }
    const formData = new FormData()
    const rawFile = (fileList[0] as any).originFileObj || fileList[0]
    formData.append('file', rawFile)
    formData.append('batch_name', fileList[0].name)

    setPreviewLoading(true)
    try {
      const res: any = await previewImport(formData)
      setPreviewData(res)
      setBatchName(fileList[0].name)
      setPreviewVisible(true)
    } catch (err: any) {
      message.error(err.detail || '预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleImport = async () => {
    if (!previewData) return
    const formData = new FormData()
    formData.append('temp_token', previewData.temp_token)
    formData.append('name', batchName)
    formData.append('filename', fileList[0]?.name || batchName)

    setUploading(true)
    try {
      const res: any = await importHazards(formData)
      setResult(res)
      message.success(`导入完成：成功 ${res.success_count} 条，失败 ${res.fail_count} 条`)
      setPreviewVisible(false)
      if (res.fail_count > 0) {
        const errs: any = await getImportErrors(res.batch.id)
        setErrors(errs)
      } else {
        navigate('/batches/history')
      }
    } catch (err: any) {
      message.error(err.detail || '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async (format: 'excel' | 'csv') => {
    try {
      const blob = await downloadTemplate(format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'csv' ? 'template.csv' : 'template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('模板下载失败')
    }
  }

  const previewColumns = [
    { title: '行号', dataIndex: 'row_index', key: 'row_index', width: 60, fixed: 'left' as const },
    { title: '企业名称', dataIndex: 'enterprise_name', key: 'enterprise_name', width: 160 },
    { title: '重大隐患描述', dataIndex: 'description', key: 'description', width: 260 },
    { title: '隐患位置', dataIndex: 'location', key: 'location', width: 100 },
    { title: '隐患分类', dataIndex: 'category', key: 'category', width: 100 },
    { title: '检查方式', dataIndex: 'inspection_method', key: 'inspection_method', width: 100 },
    { title: '检查人', dataIndex: 'inspector', key: 'inspector', width: 90 },
    { title: '检查时间', dataIndex: 'inspection_date', key: 'inspection_date', width: 110 },
    { title: '是否整改', dataIndex: 'is_rectified', key: 'is_rectified', width: 90 },
    { title: '整改完成时间', dataIndex: 'rectification_date', key: 'rectification_date', width: 120 },
    { title: '整改责任人', dataIndex: 'rectification_responsible', key: 'rectification_responsible', width: 120 },
    { title: '整改措施', dataIndex: 'rectification_measures', key: 'rectification_measures', width: 140 },
    { title: '统一社会信用代码', dataIndex: 'credit_code', key: 'credit_code', width: 140 },
    { title: '属地', dataIndex: 'region', key: 'region', width: 80 },
    { title: '详细地址', dataIndex: 'address', key: 'address', width: 120 },
    { title: '负责人', dataIndex: 'contact_person', key: 'contact_person', width: 80 },
    { title: '行业领域', dataIndex: 'industry_sector', key: 'industry_sector', width: 100 },
    { title: '企业类型', dataIndex: 'enterprise_type', key: 'enterprise_type', width: 100 },
    { title: '上报单位', dataIndex: 'reporting_unit', key: 'reporting_unit', width: 100 },
    { title: '判定依据', dataIndex: 'judgment_basis', key: 'judgment_basis', width: 140 },
    { title: '举报备注', dataIndex: 'report_remarks', key: 'report_remarks', width: 120 },
    {
      title: '校验结果',
      key: 'errors',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: PreviewItem) => (
        <span style={{ color: record.errors.length > 0 ? 'red' : 'green' }}>
          {record.errors.length > 0 ? record.errors.join('；') : '通过'}
        </span>
      ),
    },
  ]

  const errorColumns = [
    { title: '行号', dataIndex: 'row_index', key: 'row_index' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '原始数据', dataIndex: 'raw_data', key: 'raw_data' },
  ]

  return (
    <div>
      <Card title="隐患批量导入" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Upload
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              accept=".xlsx,.xls,.csv"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <Button onClick={handlePreview} loading={previewLoading}>
              预览
            </Button>
            <Button onClick={() => handleDownloadTemplate('excel')}>下载 Excel 模板</Button>
            <Button onClick={() => handleDownloadTemplate('csv')}>下载 CSV 模板</Button>
          </Space>
          <div style={{ color: '#666', fontSize: 14, lineHeight: 1.8 }}>
            <p><strong>导入说明：</strong></p>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>支持 .xlsx、.xls、.csv 格式文件</li>
              <li>系统支持以下列名（中英文均可），您可根据实际排查表提供对应字段：</li>
              <li style={{ listStyle: 'none', paddingLeft: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 4, marginTop: 4 }}>
                  <span>• 企业名称 / enterprise_name</span>
                  <span>• 统一社会信用代码 / credit_code</span>
                  <span>• 属地 / region</span>
                  <span>• 详细地址 / address</span>
                  <span>• 负责人 / contact_person</span>
                  <span>• 行业领域 / industry_sector</span>
                  <span>• 企业类型 / enterprise_type</span>
                  <span>• 上报单位 / reporting_unit</span>
                  <span>• 重大隐患描述 / description</span>
                  <span>• 隐患位置 / location</span>
                  <span>• 隐患分类 / category</span>
                  <span>• 检查方式 / inspection_method</span>
                  <span>• 检查人 / inspector</span>
                  <span>• 检查时间 / inspection_date</span>
                  <span>• 判定依据 / judgment_basis</span>
                  <span>• 违反判定依据具体条款 / violation_clause</span>
                  <span>• 是否整改 / is_rectified</span>
                  <span>• 实际整改完成时间 / rectification_date</span>
                  <span>• 整改责任部门/责任人 / rectification_responsible</span>
                  <span>• 整改措施 / rectification_measures</span>
                  <span>• 举报情况备注 / report_remarks</span>
                </div>
              </li>
              <li style={{ marginTop: 8 }}><strong>必填项：</strong>企业名称、重大隐患描述。若为空则该行数据无法导入。</li>
              <li>系统会自动检测最近 1 个月内是否已存在相同的企业 + 重大隐患描述 + 隐患位置，重复数据将被拒绝导入。</li>
              <li>导入后，若某些字段在文件中为空，管理员可在“隐患管理”页面中对该隐患进行补充编辑；已有值的字段不可修改。</li>
              <li>建议先下载模板，按模板格式整理数据后再上传。上传后点击“预览”查看校验结果，确认无误后再点击“确认导入”。</li>
            </ul>
          </div>
        </Space>
      </Card>

      {result && (
        <Card title="导入结果" style={{ marginBottom: 16 }}>
          <p>批次名称: {result.batch.name}</p>
          <p>成功: {result.success_count} 条</p>
          <p>失败: {result.fail_count} 条</p>
        </Card>
      )}

      {errors.length > 0 && (
        <Card title="失败明细">
          <Table rowKey="id" columns={errorColumns} dataSource={errors} pagination={{ pageSize: 10 }} />
        </Card>
      )}

      <Modal
        title={`数据预览（共 ${previewData?.total || 0} 条，展示前 50 条）`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={1200}
        footer={[
          <Button key="cancel" onClick={() => setPreviewVisible(false)}>
            取消
          </Button>,
          <Button key="import" type="primary" loading={uploading} onClick={handleImport}>
            确认导入
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <span>批次名称：</span>
          <Input
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <Table
          rowKey="row_index"
          columns={previewColumns}
          dataSource={previewData?.items || []}
          pagination={false}
          size="small"
          scroll={{ x: 2200 }}
        />
      </Modal>
    </div>
  )
}

export default BatchImport
