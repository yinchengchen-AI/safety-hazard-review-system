import { useEffect, useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Card,
  List,
  Checkbox,
  Typography,
  Divider,
  Empty,
} from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import { useNavigate } from 'react-router-dom'
import { getTasks, completeTask, cancelTask, createTask } from '../../api/task'
import { getBatches } from '../../api/batch'
import { getHazards } from '../../api/hazard'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待执行' },
  completed: { color: 'green', text: '已完成' },
  cancelled: { color: 'default', text: '已取消' },
}

const reportStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '生成中' },
  processing: { color: 'processing', text: '处理中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '生成失败' },
}

const { Title, Text } = Typography

function TaskList() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createForm] = Form.useForm()
  const [createLoading, setCreateLoading] = useState(false)

  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])

  const [hazards, setHazards] = useState<any[]>([])
  const [hazardLoading, setHazardLoading] = useState(false)
  const [selectedHazardIds, setSelectedHazardIds] = useState<string[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res: any = await getTasks()
      setData(res || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id)
      message.success('任务完成')
      fetchData()
    } catch (err: any) {
      message.error(err.detail || '操作失败')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelTask(id)
      message.success('任务已取消')
      fetchData()
    } catch (err: any) {
      message.error(err.detail || '操作失败')
    }
  }

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: '创建人', dataIndex: 'creator_username', key: 'creator_username' },
    { title: '隐患数', dataIndex: 'hazard_count', key: 'hazard_count' },
    { title: '已复核', dataIndex: 'reviewed_count', key: 'reviewed_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
    },
    {
      title: '报告状态',
      dataIndex: 'report_status',
      key: 'report_status',
      render: (report_status: string | undefined) =>
        report_status ? (
          <Tag color={reportStatusMap[report_status]?.color}>
            {reportStatusMap[report_status]?.text || report_status}
          </Tag>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/tasks/${record.id}`)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" onClick={() => handleComplete(record.id)}>
                完成任务
              </Button>
              <Button type="link" danger onClick={() => handleCancel(record.id)}>
                取消
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const openCreateModal = async () => {
    setCreateModalVisible(true)
    setSelectedBatchIds([])
    setSelectedHazardIds([])
    setHazards([])
    createForm.resetFields()
    try {
      const res: any = await getBatches({ page: 1, page_size: 100 })
      setBatches(res || [])
    } catch {}
  }

  const closeCreateModal = () => {
    setCreateModalVisible(false)
    setSelectedBatchIds([])
    setSelectedHazardIds([])
    setHazards([])
    createForm.resetFields()
  }

  const handleBatchSelect = async (values: string[]) => {
    setSelectedBatchIds(values)
    setSelectedHazardIds([])
    if (values.length === 0) {
      setHazards([])
      return
    }
    setHazardLoading(true)
    try {
      const res: any = await getHazards({ batch_ids: values, page: 1, page_size: 500 })
      setHazards(res.items || [])
    } catch {
      setHazards([])
    } finally {
      setHazardLoading(false)
    }
  }

  const toggleHazard = (hazardId: string, checked: boolean) => {
    setSelectedHazardIds((prev) =>
      checked ? [...prev, hazardId] : prev.filter((id) => id !== hazardId)
    )
  }

  const selectableHazards = hazards.filter((h) => !h.current_task_id)
  const isAllSelected = selectableHazards.length > 0 && selectableHazards.every((h) => selectedHazardIds.includes(h.id))
  const isIndeterminate =
    selectableHazards.some((h) => selectedHazardIds.includes(h.id)) &&
    !selectableHazards.every((h) => selectedHazardIds.includes(h.id))

  const handleSelectAll = (e: CheckboxChangeEvent) => {
    if (e.target.checked) {
      setSelectedHazardIds(selectableHazards.map((h) => h.id))
    } else {
      setSelectedHazardIds([])
    }
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      if (selectedBatchIds.length === 0 && selectedHazardIds.length === 0) {
        message.error('请至少选择一个批次或隐患')
        return
      }
      setCreateLoading(true)
      await createTask({
        name: values.name,
        batch_ids: selectedHazardIds.length === 0 ? selectedBatchIds : [],
        hazard_ids: selectedHazardIds,
      })
      message.success('创建成功')
      closeCreateModal()
      fetchData()
    } catch (err: any) {
      message.error(err.detail || '创建失败')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreateModal}>
          创建复核任务
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} />

      <Modal
        title="创建复核任务"
        open={createModalVisible}
        onOk={handleCreateSubmit}
        onCancel={closeCreateModal}
        confirmLoading={createLoading}
        width={720}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>

          <Form.Item label="选择批次">
            <Select
              mode="multiple"
              placeholder="请选择批次（可选）"
              allowClear
              style={{ width: '100%' }}
              value={selectedBatchIds}
              onChange={handleBatchSelect}
              options={batches.map((b) => ({
                value: b.id,
                label: `${b.name}（可用隐患 ${b.available_hazard_count || 0}）- ${new Date(b.created_at).toLocaleString()}`,
              }))}
            />
          </Form.Item>

          <Divider />

          <div style={{ marginBottom: 8 }}>
            <Title level={5}>选择隐患</Title>
            <Text type="secondary">已选 {selectedHazardIds.length} 条隐患</Text>
          </div>

          {hazards.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Checkbox
                indeterminate={isIndeterminate}
                checked={isAllSelected}
                onChange={handleSelectAll}
              >
                全选
              </Checkbox>
            </div>
          )}

          <Card loading={hazardLoading} bodyStyle={{ maxHeight: 320, overflow: 'auto' }}>
            {hazards.length === 0 ? (
              <Empty description="请先选择批次" />
            ) : (
              <List
                dataSource={hazards}
                renderItem={(item: any) => {
                  const locked = !!item.current_task_id
                  return (
                    <List.Item>
                      <Checkbox
                        checked={selectedHazardIds.includes(item.id)}
                        disabled={locked}
                        onChange={(e) => toggleHazard(item.id, e.target.checked)}
                      >
                        <Space direction="vertical" size={0}>
                          <Space>
                            <Text strong>{item.enterprise_name || '未分配企业'}</Text>
                            {locked && <Tag color="default">已锁定</Tag>}
                          </Space>
                          <Text type="secondary">{item.description || item.content || '-'}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.location || '-'} | {item.category || '-'} | {item.inspection_method || '-'}
                          </Text>
                        </Space>
                      </Checkbox>
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskList
