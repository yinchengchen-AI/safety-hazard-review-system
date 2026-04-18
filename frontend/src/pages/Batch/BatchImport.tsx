import { useState } from 'react'
import { Upload, Button, message, Table, Space, Modal, Input } from 'antd'
import { UploadOutlined, FileExcelOutlined, FileTextOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, InboxOutlined } from '@ant-design/icons'
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
        <span style={{ color: record.errors.length > 0 ? 'var(--error)' : 'var(--success)', fontWeight: 500 }}>
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
      <div className="app-card animate-fade-in-up delay-0" style={{ marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>隐患批量导入</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>上传隐患数据文件，系统将自动校验并导入</p>
        </div>
        <div style={{ padding: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: 40,
                textAlign: 'center',
                background: 'var(--bg-page)',
                transition: 'border-color var(--transition-base), background var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--primary-light)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)'
                e.currentTarget.style.background = 'var(--bg-page)'
              }}
            >
              <Upload
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                beforeUpload={() => false}
                maxCount={1}
                accept=".xlsx,.xls,.csv"
                style={{ width: '100%' }}
              >
                <div style={{ cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      marginBottom: 16,
                    }}
                  >
                    <InboxOutlined />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                    点击或拖拽文件到此处上传
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>支持 .xlsx、.xls、.csv 格式文件</div>
                </div>
              </Upload>

              {fileList.length > 0 && (
                <div className="animate-fade-in" style={{ marginTop: 20 }}>
                  <Space>
                    <Button type="primary" icon={<UploadOutlined />} onClick={handlePreview} loading={previewLoading}>
                      预览校验
                    </Button>
                    <Button onClick={() => setFileList([])}>清除文件</Button>
                  </Space>
                </div>
              )}
            </div>

            <div
              style={{
                background: 'var(--primary-light)',
                borderRadius: 'var(--radius-md)',
                padding: 20,
                border: '1px solid rgba(22, 119, 255, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <InfoCircleOutlined style={{ fontSize: 20, color: 'var(--primary)', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>导入说明</div>
                  <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.9 }}>
                    <li>系统支持以下列名（中英文均可），您可根据实际排查表提供对应字段：</li>
                    <li style={{ listStyle: 'none', paddingLeft: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6, marginTop: 8, color: 'var(--text-primary)' }}>
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
                    <li style={{ marginTop: 10 }}><strong>必填项：</strong>企业名称、重大隐患描述。若为空则该行数据无法导入。</li>
                    <li>系统会自动检测最近 1 个月内是否已存在相同的企业 + 重大隐患描述 + 隐患位置，重复数据将被拒绝导入。</li>
                    <li>导入后，若某些字段在文件中为空，管理员可在“隐患管理”页面中对该隐患进行补充编辑；已有值的字段不可修改。</li>
                    <li>建议先下载模板，按模板格式整理数据后再上传。上传后点击“预览”查看校验结果，确认无误后再点击“确认导入”。</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button icon={<FileExcelOutlined />} onClick={() => handleDownloadTemplate('excel')}>
                下载 Excel 模板
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => handleDownloadTemplate('csv')}>
                下载 CSV 模板
              </Button>
            </div>
          </Space>
        </div>
      </div>

      {result && (
        <div
          className="app-card animate-fade-in-up delay-1"
          style={{
            marginBottom: 24,
            borderLeft: `4px solid ${result.fail_count > 0 ? 'var(--warning)' : 'var(--success)'}`,
          }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {result.fail_count > 0 ? (
                <CloseCircleOutlined style={{ fontSize: 28, color: 'var(--warning)' }} />
              ) : (
                <CheckCircleOutlined style={{ fontSize: 28, color: 'var(--success)' }} />
              )}
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>导入结果</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div
                style={{
                  background: 'var(--bg-page)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>批次名称</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{result.batch.name}</div>
              </div>
              <div
                style={{
                  background: 'var(--success-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>成功导入</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{result.success_count}</div>
              </div>
              <div
                style={{
                  background: result.fail_count > 0 ? 'var(--warning-light)' : 'var(--bg-page)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>导入失败</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: result.fail_count > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  {result.fail_count}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="app-card animate-fade-in-up delay-2" style={{ marginBottom: 24 }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CloseCircleOutlined style={{ color: 'var(--error)', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>失败明细</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>共 {errors.length} 条</span>
          </div>
          <div style={{ padding: 20 }}>
            <div className="app-table">
              <Table rowKey="id" columns={errorColumns} dataSource={errors} pagination={{ pageSize: 10 }} />
            </div>
          </div>
        </div>
      )}

      <Modal
        title={`数据预览（共 ${previewData?.total || 0} 条，展示前 50 条）`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={1200}
        className="app-modal"
        footer={[
          <Button key="cancel" onClick={() => setPreviewVisible(false)}>
            取消
          </Button>,
          <Button key="import" type="primary" loading={uploading} onClick={handleImport}>
            确认导入
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>批次名称：</span>
          <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} style={{ width: 320 }} />
        </div>
        <div className="app-table">
          <Table
            rowKey="row_index"
            columns={previewColumns}
            dataSource={previewData?.items || []}
            pagination={false}
            size="small"
            scroll={{ x: 2200 }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default BatchImport
