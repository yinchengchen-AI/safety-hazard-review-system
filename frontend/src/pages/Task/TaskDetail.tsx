import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  List,
  Button,
  Tag,
  Space,
  message,
  Upload,
  Form,
  Input,
  Radio,
  Modal,
  Collapse,
  Popconfirm,
  Checkbox,
  Image,
} from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import { UploadOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { getTask, reviewHazard, removeHazardFromTask, batchReviewHazard, completeTask } from '../../api/task'
import { uploadPhoto, deletePhoto } from '../../api/photo'
import { generateReport, getReportStatus, downloadReport } from '../../api/report'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待复核' },
  passed: { color: 'green', text: '已通过' },
  failed: { color: 'red', text: '未通过' },
}

const taskStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待复核' },
  completed: { color: 'green', text: '已完成' },
  cancelled: { color: 'red', text: '已取消' },
}

function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<any>(null)
  const [, setLoading] = useState(false)
  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [batchReviewModalVisible, setBatchReviewModalVisible] = useState(false)
  const [currentHazard, setCurrentHazard] = useState<any>(null)
  const [form] = Form.useForm()
  const [batchForm] = Form.useForm()
  const [photoTokens, setPhotoTokens] = useState<string[]>([])
  const [reportStatus, setReportStatus] = useState<any>(null)
  const [selectedHazardIds, setSelectedHazardIds] = useState<string[]>([])

  const fetchTask = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res: any = await getTask(id)
      setTask(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
  }, [id])

  useEffect(() => {
    if (id) checkReportStatus()
  }, [id])

  const checkReportStatus = async () => {
    if (!id) return
    try {
      const res: any = await getReportStatus(id)
      setReportStatus(res)
    } catch {}
  }

  const handleReview = async (values: any) => {
    if (!id || !currentHazard) return
    try {
      await reviewHazard(id, currentHazard.hazard_id, {
        ...values,
        photo_tokens: photoTokens,
      })
      message.success(currentHazard.task_hazard.status_in_task ? '复核修改成功' : '复核提交成功')
      closeReviewModal()
      fetchTask()
    } catch (err: any) {
      message.error(err.detail || '提交失败')
    }
  }

  const handleBatchReview = async (values: any) => {
    if (!id || selectedHazardIds.length === 0) return
    try {
      await batchReviewHazard(id, {
        items: selectedHazardIds.map((hazardId) => ({
          hazard_id: hazardId,
          ...values,
          photo_tokens: photoTokens,
        })),
      })
      message.success('批量复核成功')
      closeBatchReviewModal()
      fetchTask()
    } catch (err: any) {
      message.error(err.detail || '批量复核失败')
    }
  }

  const closeReviewModal = () => {
    setReviewModalVisible(false)
    setCurrentHazard(null)
    setPhotoTokens([])
    form.resetFields()
  }

  const closeBatchReviewModal = () => {
    setBatchReviewModalVisible(false)
    setPhotoTokens([])
    batchForm.resetFields()
  }

  const openReviewModal = (item: any) => {
    setCurrentHazard(item)
    setPhotoTokens([])
    form.setFieldsValue({
      conclusion: item.task_hazard.conclusion || '',
      status_in_task: item.task_hazard.status_in_task || undefined,
    })
    setReviewModalVisible(true)
  }

  const handleRemoveHazard = async (hazardId: string) => {
    if (!id) return
    try {
      await removeHazardFromTask(id, hazardId)
      message.success('移除成功')
      setSelectedHazardIds((prev) => prev.filter((hid) => hid !== hazardId))
      fetchTask()
    } catch (err: any) {
      message.error(err.detail || '移除失败')
    }
  }

  const handleUpload = async ({ file }: any) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res: any = await uploadPhoto(formData)
      setPhotoTokens((prev) => [...prev, res.temp_token])
      message.success('照片上传成功')
    } catch (err: any) {
      message.error(err.detail || '上传失败')
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId)
      message.success('照片删除成功')
      fetchTask()
    } catch (err: any) {
      message.error(err.detail || '删除失败')
    }
  }

  const handleGenerateReport = async () => {
    if (!id) return
    try {
      await generateReport(id)
      message.success('报告生成中，请稍后刷新查看')
      setTimeout(checkReportStatus, 3000)
    } catch (err: any) {
      message.error(err.detail || '生成失败')
    }
  }

  const handleCompleteTask = async () => {
    if (!id) return
    try {
      await completeTask(id)
      message.success('任务完成')
      fetchTask()
    } catch (err: any) {
      message.error(err.detail || '完成任务失败')
    }
  }

  const toggleSelectHazard = (hazardId: string, checked: boolean) => {
    setSelectedHazardIds((prev) =>
      checked ? [...prev, hazardId] : prev.filter((hid) => hid !== hazardId)
    )
  }

  const isEnterpriseSelected = (hazards: any[]) =>
    hazards.every((h) => selectedHazardIds.includes(h.hazard_id))

  const isEnterpriseIndeterminate = (hazards: any[]) => {
    const selectedCount = hazards.filter((h) => selectedHazardIds.includes(h.hazard_id)).length
    return selectedCount > 0 && selectedCount < hazards.length
  }

  const handleSelectEnterprise = (e: CheckboxChangeEvent, hazards: any[]) => {
    const ids = hazards.map((h) => h.hazard_id)
    if (e.target.checked) {
      setSelectedHazardIds((prev) => Array.from(new Set([...prev, ...ids])))
    } else {
      setSelectedHazardIds((prev) => prev.filter((hid) => !ids.includes(hid)))
    }
  }

  if (!task) return <div>加载中...</div>

  const grouped: Record<string, any[]> = {}
  for (const item of task.hazards || []) {
    const key = item.enterprise_name || '未分配企业'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  const collapseItems = Object.entries(grouped).map(([enterpriseName, hazards]) => {
    const first = hazards[0]
    const allReviewed = hazards.every((h) => h.task_hazard.status_in_task)
    return {
      key: enterpriseName,
      label: (
        <Space>
          {task.status === 'pending' && (
            <Checkbox
              checked={isEnterpriseSelected(hazards)}
              indeterminate={isEnterpriseIndeterminate(hazards)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleSelectEnterprise(e, hazards)}
            />
          )}
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{enterpriseName}</span>
          <span style={{ color: '#888' }}>
            行业领域: {first.enterprise_industry_sector || '-'} | 所属地区: {first.enterprise_region || '-'}
          </span>
          <Tag>{hazards.length} 条隐患</Tag>
          {allReviewed && <Tag color="green">已全复核</Tag>}
        </Space>
      ),
      children: (
        <List
          dataSource={hazards}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                task.status !== 'cancelled' && (
                  item.task_hazard.status_in_task ? (
                    <Button
                      type="link"
                      onClick={() => openReviewModal(item)}
                    >
                      编辑复核
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => openReviewModal(item)}
                    >
                      复核
                    </Button>
                  )
                ),
                task.status === 'pending' && (
                  <Popconfirm
                    title="确认移除？"
                    description="移除后该隐患将恢复为可选状态"
                    onConfirm={() => handleRemoveHazard(item.hazard_id)}
                  >
                    <Button danger type="link">
                      移除
                    </Button>
                  </Popconfirm>
                ),
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {task.status === 'pending' && (
                      <Checkbox
                        checked={selectedHazardIds.includes(item.hazard_id)}
                        onChange={(e) => toggleSelectHazard(item.hazard_id, e.target.checked)}
                      />
                    )}
                    <span>{item.content}</span>
                    {item.task_hazard.status_in_task && (
                      <Tag color={statusMap[item.task_hazard.status_in_task]?.color}>
                        {statusMap[item.task_hazard.status_in_task]?.text}
                      </Tag>
                    )}
                  </Space>
                }
                description={`位置: ${item.location || '-'} | 当前状态: ${statusMap[item.status]?.text || '-'} | 是否整改: ${item.is_rectified || '-'} | 整改责任人: ${item.rectification_responsible || '-'} | 整改措施: ${item.rectification_measures || '-'} | 上报单位: ${item.reporting_unit || '-'}`}
              />
              {item.task_hazard.conclusion && (
                <div style={{ marginTop: 8 }}>
                  <strong>复核结论:</strong> {item.task_hazard.conclusion}
                </div>
              )}
              {item.task_hazard.photos && item.task_hazard.photos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Image.PreviewGroup>
                    {item.task_hazard.photos.map((p: any) => (
                      <div key={p.id} style={{ display: 'inline-block', position: 'relative', marginRight: 8 }}>
                        <Image
                          src={p.thumbnail_url || p.original_url}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                        />
                        {task.status === 'pending' && (
                          <Button
                            type="primary"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              minWidth: 24,
                              height: 24,
                              padding: 0,
                            }}
                            onClick={() => handleDeletePhoto(p.id)}
                          />
                        )}
                      </div>
                    ))}
                  </Image.PreviewGroup>
                </div>
              )}
            </List.Item>
          )}
        />
      ),
    }
  })

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            <span>任务信息</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2}>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creator_username}</Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <Tag color={taskStatusMap[task.status]?.color}>{taskStatusMap[task.status]?.text || task.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at}</Descriptions.Item>
          <Descriptions.Item label="隐患数">{task.hazard_count}</Descriptions.Item>
          <Descriptions.Item label="已复核">{task.reviewed_count}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="隐患清单"
        extra={
          <Space>
            {task.status === 'pending' && (
              <Button
                type="primary"
                disabled={selectedHazardIds.length === 0}
                onClick={() => setBatchReviewModalVisible(true)}
              >
                批量复核 ({selectedHazardIds.length})
              </Button>
            )}
            {task.status === 'pending' && (
              <Popconfirm
                title="确认完成任务？"
                description="完成任务后所有隐患将释放锁定状态，且任务不可再修改"
                onConfirm={handleCompleteTask}
              >
                <Button>完成任务</Button>
              </Popconfirm>
            )}
            {task.status !== 'cancelled' && (
              <Button onClick={handleGenerateReport}>生成报告</Button>
            )}
            {reportStatus?.status === 'completed' && task.status !== 'cancelled' && (
              <>
                <Button onClick={async () => {
                  const res: any = await downloadReport(id!, 'word')
                  window.open(res.download_url, '_blank')
                }}>下载 Word</Button>
                <Button onClick={async () => {
                  const res: any = await downloadReport(id!, 'pdf')
                  window.open(res.download_url, '_blank')
                }}>下载 PDF</Button>
              </>
            )}
            {reportStatus && task.status !== 'cancelled' && <Tag>{reportStatus.status}</Tag>}
          </Space>
        }
      >
        <Collapse items={collapseItems} />
      </Card>

      <Modal
        title={currentHazard?.task_hazard?.status_in_task ? '编辑复核' : '现场复核'}
        open={reviewModalVisible}
        onOk={() => form.submit()}
        onCancel={closeReviewModal}
      >
        <Form form={form} onFinish={handleReview} layout="vertical">
          <Form.Item name="conclusion" label="复核结论" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status_in_task" label="复核状态" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="passed">已通过</Radio>
              <Radio value="failed">未通过</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="上传照片">
            <Upload customRequest={handleUpload} listType="picture" multiple>
              <Button icon={<UploadOutlined />}>上传照片</Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#888' }}>已上传 {photoTokens.length} 张照片</div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量复核"
        open={batchReviewModalVisible}
        onOk={() => batchForm.submit()}
        onCancel={closeBatchReviewModal}
      >
        <Form form={batchForm} onFinish={handleBatchReview} layout="vertical">
          <Form.Item name="conclusion" label="复核结论" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status_in_task" label="复核状态" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="passed">已通过</Radio>
              <Radio value="failed">未通过</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="上传照片">
            <Upload customRequest={handleUpload} listType="picture" multiple>
              <Button icon={<UploadOutlined />}>上传照片</Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#888' }}>已上传 {photoTokens.length} 张照片</div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskDetail
