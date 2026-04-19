import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Button, Tag, Spin, Empty, message, Typography, Statistic, Row, Col } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getEnterprise, getEnterpriseStatistics, type Enterprise } from '../../api/enterprise'
import { getHazards } from '../../api/hazard'

const { Title } = Typography

interface EnterpriseStats {
  total_hazards: number
  pending_count: number
  passed_count: number
  failed_count: number
  reviewed_count: number
  coverage_rate: number
  pass_rate: number
}

function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null)
  const [stats, setStats] = useState<EnterpriseStats | null>(null)
  const [hazards, setHazards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [ent, stat, haz] = await Promise.all([
          getEnterprise(id),
          getEnterpriseStatistics(id),
          getHazards({ enterprise_id: id, page: 1, page_size: 50 }),
        ])
        setEnterprise(ent)
        setStats(stat)
        setHazards((haz as any).items || [])
      } catch {
        message.error('加载企业信息失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!enterprise) {
    return <Empty description="企业不存在或已被删除" />
  }

  const hazardColumns = [
    { title: '隐患描述', dataIndex: 'content', key: 'content' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const map: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待复核' },
          passed: { color: 'green', text: '已通过' },
          failed: { color: 'red', text: '未通过' },
        }
        const s = map[status] || { color: 'default', text: status }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '检查时间',
      dataIndex: 'inspection_date',
      key: 'inspection_date',
      render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-'),
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
          gap: 16,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/enterprises')}>
          返回
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {enterprise.name}
        </Title>
      </div>

      <Card className="app-card animate-fade-in-up delay-0" title="企业信息" style={{ marginBottom: 24 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="企业名称">{enterprise.name}</Descriptions.Item>
          <Descriptions.Item label="统一社会信用代码">{enterprise.credit_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="属地">{enterprise.region || '-'}</Descriptions.Item>
          <Descriptions.Item label="详细地址">{enterprise.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{enterprise.contact_person || '-'}</Descriptions.Item>
          <Descriptions.Item label="行业领域">{enterprise.industry_sector || '-'}</Descriptions.Item>
          <Descriptions.Item label="企业类型">{enterprise.enterprise_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(enterprise.created_at).toLocaleString('zh-CN')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {stats && (
        <Card className="app-card animate-fade-in-up delay-1" title="隐患统计" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="隐患总数" value={stats.total_hazards} />
            </Col>
            <Col span={4}>
              <Statistic title="待复核" value={stats.pending_count} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col span={4}>
              <Statistic title="已通过" value={stats.passed_count} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={4}>
              <Statistic title="未通过" value={stats.failed_count} valueStyle={{ color: '#f5222d' }} />
            </Col>
            <Col span={4}>
              <Statistic title="覆盖率" value={`${stats.coverage_rate}%`} />
            </Col>
            <Col span={4}>
              <Statistic title="通过率" value={`${stats.pass_rate}%`} />
            </Col>
          </Row>
        </Card>
      )}

      <Card className="app-card animate-fade-in-up delay-2" title="关联隐患">
        <Table
          rowKey="id"
          columns={hazardColumns}
          dataSource={hazards}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无隐患" /> }}
        />
      </Card>
    </div>
  )
}

export default EnterpriseDetail
