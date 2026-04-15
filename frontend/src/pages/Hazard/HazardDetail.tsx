import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  Empty,
  Space,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getHazard } from '../../api/hazard'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待复核' },
  passed: { color: 'green', text: '已通过' },
  failed: { color: 'red', text: '未通过' },
}

function HazardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [hazard, setHazard] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getHazard(id)
      .then((res: any) => setHazard(res))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!hazard) {
    return (
      <Card>
        <Empty description="隐患不存在或已删除" />
      </Card>
    )
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            <span>隐患详情</span>
          </Space>
        }
        extra={
          <Tag color={statusMap[hazard.status]?.color}>
            {statusMap[hazard.status]?.text}
          </Tag>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions title="企业信息" bordered column={2}>
          <Descriptions.Item label="企业名称">
            {hazard.enterprise_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="统一社会信用代码">
            {hazard.enterprise_credit_code || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="所属地区">
            {hazard.enterprise_region || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="企业地址">
            {hazard.enterprise_address || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="联系人">
            {hazard.enterprise_contact_person || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="行业领域">
            {hazard.enterprise_industry_sector || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="企业类型">
            {hazard.enterprise_enterprise_type || '-'}
          </Descriptions.Item>
        </Descriptions>

        <Descriptions title="隐患信息" bordered column={2} style={{ marginTop: 24 }}>
          <Descriptions.Item label="隐患描述">
            {hazard.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="隐患位置">
            {hazard.location || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="隐患分类">
            {hazard.category || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="检查方式">
            {hazard.inspection_method || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="检查人">
            {hazard.inspector || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="检查时间">
            {hazard.inspection_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="判定依据">
            {hazard.judgment_basis || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="违反条款">
            {hazard.violation_clause || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="是否整改">
            {hazard.is_rectified || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="整改完成时间">
            {hazard.rectification_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="整改责任人">
            {hazard.rectification_responsible || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="整改措施">
            {hazard.rectification_measures || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="举报备注">
            {hazard.report_remarks || '-'}
          </Descriptions.Item>
        </Descriptions>

        <Descriptions title="批次信息" bordered column={2} style={{ marginTop: 24 }}>
          <Descriptions.Item label="批次名称">
            {hazard.batch_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="上报单位">
            {hazard.reporting_unit || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="复核次数">
            {hazard.review_count ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="锁定状态">
            {hazard.current_task_id ? (
              <Tag color="default">已锁定</Tag>
            ) : (
              <Tag color="success">未锁定</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default HazardDetail
