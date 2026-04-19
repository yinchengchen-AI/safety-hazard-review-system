import { useEffect, useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  message,
  Modal,
  Input,
  Pagination,
  Card,
  Empty,
  Select,
  Form,
  DatePicker,
  Spin,
  Row,
  Col,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { EditOutlined, EyeOutlined } from '@ant-design/icons'
import { getHazards, getHazardEditableFields, updateHazard } from '../../api/hazard'
import { getMe } from '../../api/auth'
import dayjs from 'dayjs'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待复核' },
  passed: { color: 'green', text: '已通过' },
  failed: { color: 'red', text: '未通过' },
}

const fieldLabels: Record<string, string> = {
  description: '隐患描述',
  location: '隐患位置',
  category: '隐患分类',
  inspection_method: '检查方式',
  inspector: '检查人',
  inspection_date: '检查时间',
  judgment_basis: '判定依据',
  violation_clause: '违反判定依据具体条款',
  is_rectified: '是否整改',
  rectification_date: '实际整改完成时间',
  rectification_responsible: '整改责任部门/责任人',
  rectification_measures: '整改措施',
  report_remarks: '举报情况备注',
}

const stringFields = [
  'description',
  'location',
  'category',
  'inspection_method',
  'inspector',
  'judgment_basis',
  'violation_clause',
  'is_rectified',
  'rectification_responsible',
  'rectification_measures',
  'report_remarks',
]

const dateFields = ['inspection_date', 'rectification_date']

function HazardList() {
  const [hazards, setHazards] = useState<any[]>([])
  const [hazardTotal, setHazardTotal] = useState(0)
  const [hazardPage, setHazardPage] = useState(1)
  const [hazardPageSize, setHazardPageSize] = useState(20)
  const [hazardLoading, setHazardLoading] = useState(false)

  const [enterpriseNameFilter, setEnterpriseNameFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isRectifiedFilter, setIsRectifiedFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null)

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editHazardId, setEditHazardId] = useState<string | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, boolean>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editForm] = Form.useForm()

  const navigate = useNavigate()

  useEffect(() => {
    getMe().then((res: any) => {
      setCurrentUser(res)
    }).catch(() => {
      setCurrentUser(null)
    })
  }, [])

  const fetchHazards = async () => {
    setHazardLoading(true)
    try {
      const params: any = {
        page: hazardPage,
        page_size: hazardPageSize,
      }
      if (enterpriseNameFilter.trim()) params.enterprise_name = enterpriseNameFilter.trim()
      if (categoryFilter) params.category = categoryFilter
      if (isRectifiedFilter) params.is_rectified = isRectifiedFilter
      if (statusFilter) params.status = statusFilter
      const res: any = await getHazards(params)
      setHazards(res.items || [])
      setHazardTotal(res.total || 0)
    } finally {
      setHazardLoading(false)
    }
  }

  useEffect(() => {
    fetchHazards()
  }, [hazardPage, hazardPageSize, categoryFilter, isRectifiedFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      setHazardPage(1)
      fetchHazards()
    }, 300)
    return () => clearTimeout(timer)
  }, [enterpriseNameFilter])

  const openEditModal = async (record: any) => {
    setEditHazardId(record.id)
    setEditModalVisible(true)
    setEditLoading(true)
    try {
      const res: any = await getHazardEditableFields(record.id)
      setEditableFields(res)
      const initialValues: any = {}
      stringFields.forEach((key) => {
        if (res[key]) {
          initialValues[key] = record[key] || undefined
        }
      })
      dateFields.forEach((key) => {
        if (res[key]) {
          initialValues[key] = record[key] ? dayjs(record[key]) : undefined
        }
      })
      editForm.setFieldsValue(initialValues)
    } catch (err: any) {
      message.error(err.detail || '获取可编辑字段失败')
      setEditModalVisible(false)
    } finally {
      setEditLoading(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!editHazardId) return
    try {
      const values = await editForm.validateFields()
      const payload: any = {}
      stringFields.forEach((key) => {
        if (editableFields[key] && values[key] !== undefined && values[key] !== null && values[key] !== '') {
          payload[key] = values[key]
        }
      })
      dateFields.forEach((key) => {
        if (editableFields[key] && values[key]) {
          payload[key] = values[key].format('YYYY-MM-DD')
        }
      })
      await updateHazard(editHazardId, payload)
      message.success('保存成功')
      setEditModalVisible(false)
      fetchHazards()
    } catch (err: any) {
      message.error(err.detail || '保存失败')
    }
  }

  const hazardColumns: any[] = [
    {
      title: '企业名称',
      dataIndex: 'enterprise_name',
      key: 'enterprise_name',
      fixed: 'left',
      render: (v: string, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/hazards/${record.id}`)}
        >
          {v || '-'}
        </Button>
      ),
    },
    {
      title: '隐患分类',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => v || '-',
    },
    {
      title: '隐患描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || '-',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (v: string) => v || '-',
    },
    {
      title: '检查方式',
      dataIndex: 'inspection_method',
      key: 'inspection_method',
      render: (v: string) => v || '-',
    },
    {
      title: '检查时间',
      dataIndex: 'inspection_date',
      key: 'inspection_date',
      render: (v: string) => v ? v.slice(0, 10) : '-',
    },
    {
      title: '是否整改',
      dataIndex: 'is_rectified',
      key: 'is_rectified',
      render: (v: string) => v || '-',
    },
    {
      title: '整改完成时间',
      dataIndex: 'rectification_date',
      key: 'rectification_date',
      render: (v: string) => v ? v.slice(0, 10) : '-',
    },
    {
      title: '上报单位',
      dataIndex: 'reporting_unit',
      key: 'reporting_unit',
      render: (v: string) => v || '-',
    },
    {
      title: '批次',
      dataIndex: 'batch_name',
      key: 'batch_name',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      fixed: 'right',
      width: 70,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color} style={{ borderRadius: 999, fontWeight: 500 }}>
          {statusMap[status]?.text}
        </Tag>
      ),
    },
    {
      title: '复核次数',
      dataIndex: 'review_count',
      key: 'review_count',
      fixed: 'right',
      width: 80,
    },
    {
      title: '锁定',
      key: 'locked',
      fixed: 'right',
      width: 60,
      render: (_: any, record: any) =>
        record.current_task_id ? <Tag color="default" style={{ borderRadius: 999, fontWeight: 500 }}>已锁定</Tag> : '-',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 70,
      render: (_: any, record: any) => (
        <Space>
          {currentUser?.role === 'admin' && (
            <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              编辑
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const renderEditFormItems = () => {
    const items: JSX.Element[] = []
    stringFields.forEach((key) => {
      if (editableFields[key]) {
        items.push(
          <Form.Item key={key} name={key} label={fieldLabels[key]}>
            <Input placeholder={`请输入${fieldLabels[key]}`} />
          </Form.Item>
        )
      }
    })
    dateFields.forEach((key) => {
      if (editableFields[key]) {
        items.push(
          <Form.Item key={key} name={key} label={fieldLabels[key]}>
            <DatePicker style={{ width: '100%' }} placeholder={`请选择${fieldLabels[key]}`} />
          </Form.Item>
        )
      }
    })
    if (items.length === 0) {
      return <p style={{ textAlign: 'center', color: '#888' }}>暂无可编辑字段</p>
    }
    return items
  }

  return (
    <div>
      <Card className="app-card animate-fade-in-up delay-0" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6} xl={5}>
            <Input
              placeholder="搜索企业名称"
              value={enterpriseNameFilter}
              onChange={(e) => setEnterpriseNameFilter(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3} xl={3}>
            <Select
              placeholder="隐患分类"
              allowClear
              style={{ width: '100%' }}
              value={categoryFilter || undefined}
              onChange={(v) => setCategoryFilter(v || '')}
              options={[
                { value: '一般隐患', label: '一般隐患' },
                { value: '重大隐患', label: '重大隐患' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3} xl={3}>
            <Select
              placeholder="是否整改"
              allowClear
              style={{ width: '100%' }}
              value={isRectifiedFilter || undefined}
              onChange={(v) => setIsRectifiedFilter(v || '')}
              options={[
                { value: '已整改', label: '已整改' },
                { value: '未整改', label: '未整改' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3} xl={3}>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter || undefined}
              onChange={(v) => setStatusFilter(v || '')}
              options={[
                { value: 'pending', label: '待复核' },
                { value: 'passed', label: '已通过' },
                { value: 'failed', label: '未通过' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3} xl={3}>
            <Button type="primary" onClick={() => navigate('/batches/import')} style={{ width: '100%' }}>
              批量导入
            </Button>
          </Col>
        </Row>
      </Card>

      <Card
        className="app-card animate-fade-in-up delay-1 app-table"
        title={`隐患列表 · 共 ${hazardTotal} 条`}
        size="small"
        style={{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, overflow: 'auto' }}
      >
        <Table
          rowKey="id"
          columns={hazardColumns}
          dataSource={hazards}
          pagination={false}
          loading={hazardLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="暂无隐患数据" /> }}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={hazardPage}
            pageSize={hazardPageSize}
            total={hazardTotal}
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            pageSizeOptions={[10, 20, 50]}
            onChange={(p, ps) => {
              setHazardPage(p)
              if (ps) setHazardPageSize(ps)
            }}
          />
        </div>
      </Card>

      <Modal
        className="app-modal"
        title="编辑隐患"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        destroyOnClose
        width={640}
      >
        <Spin spinning={editLoading}>
          <Form form={editForm} layout="vertical">
            {renderEditFormItems()}
          </Form>
        </Spin>
      </Modal>
    </div>
  )
}

export default HazardList
