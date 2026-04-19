import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Pagination,
  Upload,
  Card,
  Typography,
} from 'antd'
import { UploadOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  getEnterprises,
  createEnterprise,
  updateEnterprise,
  deleteEnterprise,
  importEnterprises,
  exportEnterprises,
  getEnterpriseTemplate,
  type Enterprise,
  type EnterpriseCreate,
  type EnterpriseUpdate,
} from '../../api/enterprise'

const { Title, Text } = Typography

function EnterpriseList() {
  const navigate = useNavigate()
  const [data, setData] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [editingEnterprise, setEditingEnterprise] = useState<Enterprise | null>(null)
  const [form] = Form.useForm()

  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)

  const fetchData = async (currentPage = page, search = keyword) => {
    setLoading(true)
    try {
      const res = await getEnterprises({ page: currentPage, page_size: pageSize, keyword: search })
      setData(res.items || [])
      setTotal(res.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearch = () => {
    setPage(1)
    fetchData(1, keyword)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchData(newPage, keyword)
  }

  const openCreateModal = () => {
    setEditingEnterprise(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEditModal = (record: Enterprise) => {
    setEditingEnterprise(record)
    form.setFieldsValue({
      name: record.name,
      credit_code: record.credit_code,
      region: record.region,
      address: record.address,
      contact_person: record.contact_person,
      industry_sector: record.industry_sector,
      enterprise_type: record.enterprise_type,
    })
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingEnterprise) {
        const payload: EnterpriseUpdate = {}
        for (const key of Object.keys(values)) {
          if (values[key] !== undefined && values[key] !== '') {
            payload[key as keyof EnterpriseUpdate] = values[key]
          }
        }
        await updateEnterprise(editingEnterprise.id, payload)
        message.success('更新成功')
      } else {
        await createEnterprise(values as EnterpriseCreate)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData(page, keyword)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后该企业将不再显示，是否继续？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteEnterprise(id)
          message.success('删除成功')
          fetchData(page, keyword)
        } catch (err: any) {
          message.error(err.response?.data?.detail || '删除失败')
        }
      },
    })
  }

  const handleExport = async () => {
    try {
      const blob = await exportEnterprises()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '企业列表.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch {
      message.error('导出失败')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await getEnterpriseTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '企业导入模板.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('模板下载失败')
    }
  }

  const handleImport = async (file: File) => {
    setImportLoading(true)
    setImportResult(null)
    try {
      const result = await importEnterprises(file)
      setImportResult({ success: result.success_count, errors: result.errors })
      if (result.success_count > 0) {
        fetchData(page, keyword)
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '导入失败')
    } finally {
      setImportLoading(false)
    }
    return false
  }

  const columns = [
    {
      title: '企业名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Enterprise) => (
        <a onClick={() => navigate(`/enterprises/${record.id}`)}>{name}</a>
      ),
    },
    { title: '统一社会信用代码', dataIndex: 'credit_code', key: 'credit_code' },
    { title: '属地', dataIndex: 'region', key: 'region' },
    { title: '行业领域', dataIndex: 'industry_sector', key: 'industry_sector' },
    { title: '企业类型', dataIndex: 'enterprise_type', key: 'enterprise_type' },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Enterprise) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div
        className="app-card"
        style={{
          marginBottom: 24,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>企业管理</Title>
          <Text type="secondary">管理企业信息，支持搜索、导入和导出</Text>
        </div>
        <Space>
          <Input
            placeholder="搜索企业名称、信用代码、属地、负责人"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
          />
          <Button onClick={handleSearch}>搜索</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增企业
          </Button>
        </Space>
      </div>

      <Card className="app-card app-table animate-fade-in-up delay-1">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger={false}
          />
        </div>
      </Card>

      <Modal
        title={editingEnterprise ? '编辑企业' : '新增企业'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
            <Input placeholder="企业名称" />
          </Form.Item>
          <Form.Item name="credit_code" label="统一社会信用代码">
            <Input placeholder="统一社会信用代码" />
          </Form.Item>
          <Form.Item name="region" label="属地">
            <Input placeholder="属地" />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item name="contact_person" label="负责人">
            <Input placeholder="负责人" />
          </Form.Item>
          <Form.Item name="industry_sector" label="行业领域">
            <Input placeholder="行业领域" />
          </Form.Item>
          <Form.Item name="enterprise_type" label="企业类型">
            <Input placeholder="企业类型" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入企业"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false)
          setImportResult(null)
        }}
        footer={null}
      >
        <Upload beforeUpload={handleImport} accept=".xlsx,.xls,.csv" showUploadList={false}>
          <Button icon={<UploadOutlined />} loading={importLoading}>
            选择文件
          </Button>
        </Upload>
        <p style={{ marginTop: 12, color: '#999' }}>支持 Excel (.xlsx, .xls) 或 CSV 格式</p>
        {importResult && (
          <div style={{ marginTop: 16 }}>
            <p>成功导入: {importResult.success} 条</p>
            {importResult.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflow: 'auto', background: '#fff2f0', padding: 12, borderRadius: 4 }}>
                {importResult.errors.map((err, i) => (
                  <p key={i} style={{ color: '#cf1322', margin: '4px 0', fontSize: 13 }}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default EnterpriseList
