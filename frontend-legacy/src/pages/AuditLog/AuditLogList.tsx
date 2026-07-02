import { useEffect, useState } from 'react'
import { Table, Tag, Input, Select, DatePicker, Button, Pagination, Space, Typography } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { getAuditLogs } from '../../api/auditLog'
import { useUserStore } from '../../store/userStore'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const actionColorMap: Record<string, string> = {
  创建: 'blue',
  更新: 'orange',
  删除: 'red',
  登录: 'green',
  登出: 'default',
  导入: 'cyan',
  导出: 'purple',
  完成: 'success',
  取消: 'warning',
  重置密码: 'volcano',
}

const targetTypeMap: Record<string, string> = {
  hazard: '隐患',
  batch: '批次',
  task: '任务',
  user: '用户',
  report: '报告',
  auth: '认证',
  system: '系统',
}

interface AuditLogItem {
  id: string
  user_id: string | null
  username: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail: string | null
  ip_address: string | null
  method: string | null
  path: string | null
  status_code: number | null
  created_at: string
}

function AuditLogList() {
  const { user } = useUserStore()
  const [data, setData] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const fetchData = async (currentPage = page) => {
    if (user?.role !== 'admin') {
      setData([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      const params: any = {
        page: currentPage,
        page_size: pageSize,
      }
      if (actionFilter) params.action = actionFilter
      if (targetTypeFilter) params.target_type = targetTypeFilter
      if (keyword) params.target_id = keyword
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }

      const res: any = await getAuditLogs(params)
      setData(res.items || [])
      setTotal(res.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const handleSearch = () => {
    setPage(1)
    fetchData(1)
  }

  const handleReset = () => {
    setActionFilter('')
    setTargetTypeFilter('')
    setKeyword('')
    setDateRange(null)
    setPage(1)
    fetchData(1)
  }

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
    fetchData(newPage)
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (val: string | null) => val || '系统',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (val: string) => (
        <Tag color={actionColorMap[val] || 'default'}>{val}</Tag>
      ),
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (val: string | null) => (val ? targetTypeMap[val] || val : '-'),
    },
    {
      title: '对象ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 220,
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: '请求',
      key: 'request',
      width: 200,
      render: (_: any, record: AuditLogItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.method} {record.path}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 80,
      render: (val: number | null) => {
        if (!val) return '-'
        const color = val < 400 ? 'success' : val < 500 ? 'warning' : 'error'
        return <Tag color={color}>{val}</Tag>
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (val: string | null) => val || '-',
    },
  ]

  if (user?.role !== 'admin') {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Title level={3} style={{ color: 'var(--text-secondary)' }}>
          无权访问
        </Title>
        <Text type="secondary">您没有权限查看操作日志</Text>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div
        className="app-card animate-fade-in-up delay-0"
        style={{
          marginBottom: 20,
          padding: '20px 24px',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            操作日志
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            查看系统所有数据变更操作记录
          </Text>
        </div>

        <Space wrap style={{ rowGap: 12 }}>
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 140 }}
            value={actionFilter || undefined}
            onChange={(val) => setActionFilter(val || '')}
            options={[
              { value: '创建', label: '创建' },
              { value: '更新', label: '更新' },
              { value: '删除', label: '删除' },
              { value: '登录', label: '登录' },
              { value: '登出', label: '登出' },
              { value: '导入', label: '导入' },
              { value: '导出', label: '导出' },
              { value: '完成', label: '完成' },
              { value: '取消', label: '取消' },
              { value: '重置密码', label: '重置密码' },
            ]}
          />
          <Select
            placeholder="对象类型"
            allowClear
            style={{ width: 140 }}
            value={targetTypeFilter || undefined}
            onChange={(val) => setTargetTypeFilter(val || '')}
            options={[
              { value: 'hazard', label: '隐患' },
              { value: 'batch', label: '批次' },
              { value: 'task', label: '任务' },
              { value: 'user', label: '用户' },
              { value: 'report', label: '报告' },
              { value: 'auth', label: '认证' },
              { value: 'system', label: '系统' },
            ]}
          />
          <Input
            placeholder="对象ID / 关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 220 }}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            placeholder={['开始日期', '结束日期']}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <div className="app-card app-table animate-fade-in-up delay-1" style={{ padding: 20 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            style={{ marginTop: 16, textAlign: 'right' }}
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </div>
    </div>
  )
}

export default AuditLogList
