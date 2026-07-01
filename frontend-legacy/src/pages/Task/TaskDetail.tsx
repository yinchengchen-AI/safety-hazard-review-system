import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
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
  Timeline,
} from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import {
  UploadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import {
  getTask,
  reviewHazard,
  removeHazardFromTask,
  batchReviewHazard,
  completeTask,
} from '../../api/task'
import { uploadPhoto, deletePhoto } from '../../api/photo'
import { generateReport, getReportStatus } from '../../api/report'
import { getAuditLogs } from '../../api/auditLog'

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
  const [uploadedPhotos, setUploadedPhotos] = useState<
    { temp_token: string; original_url: string; thumbnail_url: string }[]
  >([])
  const [reportStatus, setReportStatus] = useState<any>(null)
  const [selectedHazardIds, setSelectedHazardIds] = useState<string[]>([])

  // Audit logs for this task
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)

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

  useEffect(() => {
    if (id && task?.status === 'completed') {
      checkReportStatus()
    }
  }, [id, task?.status])

  useEffect(() => {
    if (id) fetchAuditLogs()
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
        photo_tokens: uploadedPhotos.map((p) => p.temp_token),
      })
      message.success(
        currentHazard.task_hazard.status_in_task ? '复核修改成功' : '复核提交成功'
      )
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
          photo_tokens: uploadedPhotos.map((p) => p.temp_token),
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
    setUploadedPhotos([])
    form.resetFields()
  }

  const closeBatchReviewModal = () => {
    setBatchReviewModalVisible(false)
    setUploadedPhotos([])
    batchForm.resetFields()
  }

  const openReviewModal = (item: any) => {
    setCurrentHazard(item)
    setUploadedPhotos([])
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

  const MAX_PHOTO_SIZE = 10 * 1024 * 1024
  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png']

  const handleBeforeUpload = (file: File) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      message.error('仅支持 JPG 和 PNG 格式的图片')
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_PHOTO_SIZE) {
      message.error('图片大小不能超过 10MB')
      return Upload.LIST_IGNORE
    }
    return true
  }

  const handleUpload = async ({ file, onSuccess, onError }: any) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res: any = await uploadPhoto(formData)
      setUploadedPhotos((prev) => [
        ...prev,
        {
          temp_token: res.temp_token,
          original_url: res.original_url,
          thumbnail_url: res.thumbnail_url,
        },
      ])
      onSuccess?.()
      message.success('照片上传成功')
    } catch (err: any) {
      onError?.()
      message.error(err.detail || '上传失败')
    }
  }

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index))
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
      fetchAuditLogs()
    } catch (err: any) {
      message.error(err.detail || '完成任务失败')
    }
  }

  const fetchAuditLogs = async () => {
    if (!id) return
    setAuditLogsLoading(true)
    try {
      const res: any = await getAuditLogs({
        target_type: 'task',
        target_id: id,
        page: 1,
        page_size: 50,
      })
      setAuditLogs(res.items || [])
    } catch {
      setAuditLogs([])
    } finally {
      setAuditLogsLoading(false)
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
    const selectedCount = hazards.filter((h) =>
      selectedHazardIds.includes(h.hazard_id)
    ).length
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
          <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 15 }}>
            {enterpriseName}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            行业领域: {first.enterprise_industry_sector || '-'} | 所属地区:{' '}
            {first.enterprise_region || '-'}
          </span>
          <Tag
            style={{
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              padding: '2px 10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-page)',
              color: 'var(--text-secondary)',
            }}
          >
            {hazards.length} 条隐患
          </Tag>
          {allReviewed && (
            <Tag
              color="success"
              style={{ borderRadius: 999, fontSize: 12, fontWeight: 500, padding: '2px 10px' }}
            >
              已全复核
            </Tag>
          )}
        </Space>
      ),
      children: (
        <List
          dataSource={hazards}
          renderItem={(item: any) => (
            <List.Item
              style={{
                padding: '16px 18px',
                marginBottom: 10,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                transition: 'box-shadow 200ms ease',
              }}
              actions={[
                task.status !== 'cancelled' &&
                  (item.task_hazard.status_in_task ? (
                    <Button type="link" onClick={() => openReviewModal(item)}>
                      编辑复核
                    </Button>
                  ) : (
                    <Button type="primary" onClick={() => openReviewModal(item)}>
                      复核
                    </Button>
                  )),
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
                    <span style={{ fontWeight: 500, fontSize: 15 }}>{item.content}</span>
                    {item.task_hazard.status_in_task && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 500,
                          background:
                            item.task_hazard.status_in_task === 'passed'
                              ? 'var(--success-light)'
                              : 'var(--error-light)',
                          color:
                            item.task_hazard.status_in_task === 'passed'
                              ? 'var(--success)'
                              : 'var(--error)',
                          border:
                            item.task_hazard.status_in_task === 'passed'
                              ? '1px solid rgba(82, 196, 26, 0.3)'
                              : '1px solid rgba(245, 34, 45, 0.3)',
                        }}
                      >
                        {statusMap[item.task_hazard.status_in_task]?.text}
                      </span>
                    )}
                  </Space>
                }
                description={
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    位置: {item.location || '-'} | 当前状态:{' '}
                    {statusMap[item.status]?.text || '-'} | 是否整改:{' '}
                    {item.is_rectified || '-'} | 整改责任人:{' '}
                    {item.rectification_responsible || '-'} | 整改措施:{' '}
                    {item.rectification_measures || '-'} | 上报单位: {item.reporting_unit || '-'}
                  </span>
                }
              />
              {item.task_hazard.conclusion && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    background: 'var(--bg-page)',
                    borderRadius: 10,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                >
                  <strong>复核结论:</strong> {item.task_hazard.conclusion}
                </div>
              )}
              {item.task_hazard.photos && item.task_hazard.photos.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Image.PreviewGroup
                    items={item.task_hazard.photos.map((p: any) => ({
                      src: p.original_url,
                    }))}
                  >
                    {item.task_hazard.photos.map((p: any) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'inline-block',
                          position: 'relative',
                          marginRight: 10,
                        }}
                      >
                        <Image
                          src={p.thumbnail_url || p.original_url}
                          style={{
                            width: 88,
                            height: 88,
                            objectFit: 'cover',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                          }}
                          preview={{ src: p.original_url }}
                        />
                        {task.status === 'pending' && (
                          <Popconfirm
                            title="确认删除？"
                            description="删除后照片将无法恢复"
                            onConfirm={(e) => {
                              e?.stopPropagation()
                              handleDeletePhoto(p.id)
                            }}
                          >
                            <Button
                              type="primary"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                minWidth: 26,
                                height: 26,
                                padding: 0,
                                borderRadius: '0 10px 0 10px',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
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
    <div className="animate-fade-in">
      <div
        className="app-card animate-fade-in-up delay-0"
        style={{
          marginBottom: 20,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space size={16}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ borderRadius: 10 }}
          >
            返回
          </Button>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{task.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
              任务详情与隐患复核
            </div>
          </div>
        </Space>
        <Space>
          {reportStatus?.status !== 'completed' && task.status === 'completed' && (
            <Button icon={<ReloadOutlined />} onClick={handleGenerateReport} style={{ borderRadius: 10 }}>
              重新生成
            </Button>
          )}
          {reportStatus?.status === 'completed' && task.status !== 'cancelled' && (
            <>
              <Button
                icon={<FileWordOutlined />}
                style={{ borderRadius: 10 }}
                onClick={() => {
                  const token = localStorage.getItem('token') || ''
                  window.location.href = `/api/v1/reports/${id}/download?format=word&token=${encodeURIComponent(
                    token
                  )}`
                }}
              >
                下载 Word
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                style={{ borderRadius: 10 }}
                onClick={() => {
                  const token = localStorage.getItem('token') || ''
                  window.location.href = `/api/v1/reports/${id}/download?format=pdf&token=${encodeURIComponent(
                    token
                  )}`
                }}
              >
                下载 PDF
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card
        className="app-card animate-fade-in-up delay-1"
        title={<span style={{ fontWeight: 600, fontSize: 16 }}>任务信息</span>}
        style={{ marginBottom: 20 }}
      >
        <Descriptions column={2}>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creator_username}</Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                background:
                  task.status === 'completed'
                    ? 'var(--success-light)'
                    : task.status === 'cancelled'
                    ? 'var(--error-light)'
                    : 'var(--warning-light)',
                color:
                  task.status === 'completed'
                    ? 'var(--success)'
                    : task.status === 'cancelled'
                    ? 'var(--error)'
                    : 'var(--warning)',
                border:
                  task.status === 'completed'
                    ? '1px solid rgba(82, 196, 26, 0.3)'
                    : task.status === 'cancelled'
                    ? '1px solid rgba(245, 34, 45, 0.3)'
                    : '1px solid rgba(250, 173, 20, 0.3)',
              }}
            >
              {taskStatusMap[task.status]?.text || task.status}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at}</Descriptions.Item>
          <Descriptions.Item label="隐患数">{task.hazard_count}</Descriptions.Item>
          <Descriptions.Item label="已复核">{task.reviewed_count}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        className="app-card animate-fade-in-up delay-2"
        title={<span style={{ fontWeight: 600, fontSize: 16 }}>操作记录</span>}
        style={{ marginBottom: 20 }}
      >
        {auditLogs.length === 0 && !auditLogsLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
            暂无操作记录
          </div>
        ) : (
          <Timeline mode="left" pending={auditLogsLoading}>
            {auditLogs.map((log) => (
              <Timeline.Item
                key={log.id}
                label={
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                }
              >
                <div style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 500 }}>
                    {log.username || '系统'}
                  </span>
                  {' '}<span style={{ color: 'var(--text-secondary)' }}>{log.action}</span>
                  {log.detail && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                      {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {log.method} {log.path} · {log.status_code && log.status_code < 400 ? '成功' : '失败'} {log.status_code ? `(${log.status_code})` : ''}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>

      <Card
        className="app-card animate-fade-in-up delay-3"
        title={<span style={{ fontWeight: 600, fontSize: 16 }}>隐患清单</span>}
        extra={
          <Space>
            {task.status === 'pending' && (
              <Button
                type="primary"
                disabled={selectedHazardIds.length === 0}
                onClick={() => setBatchReviewModalVisible(true)}
                style={{ borderRadius: 10 }}
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
                <Button icon={<CheckCircleOutlined />} style={{ borderRadius: 10 }}>
                  完成任务
                </Button>
              </Popconfirm>
            )}
            {reportStatus && task.status !== 'cancelled' && (
              <Tag
                style={{
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '4px 12px',
                }}
              >
                报告: {reportStatus.status}
              </Tag>
            )}
          </Space>
        }
      >
        <Collapse
          items={collapseItems}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
          }}
        />
      </Card>

      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            {currentHazard?.task_hazard?.status_in_task ? '编辑复核' : '现场复核'}
          </span>
        }
        open={reviewModalVisible}
        onOk={() => form.submit()}
        onCancel={closeReviewModal}
        className="app-modal"
      >
        <Form form={form} onFinish={handleReview} layout="vertical">
          <Form.Item
            name="conclusion"
            label={<span style={{ fontWeight: 500 }}>复核结论</span>}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item
            name="status_in_task"
            label={<span style={{ fontWeight: 500 }}>复核状态</span>}
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="passed">已通过</Radio>
              <Radio value="failed">未通过</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={<span style={{ fontWeight: 500 }}>上传照片</span>}>
            <Upload
              customRequest={handleUpload}
              beforeUpload={handleBeforeUpload}
              showUploadList={false}
              multiple
            >
              <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                上传照片
              </Button>
            </Upload>
            {uploadedPhotos.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {uploadedPhotos.map((p, idx) => (
                  <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                    <Image
                      src={p.thumbnail_url || p.original_url}
                      style={{
                        width: 88,
                        height: 88,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                      }}
                      preview={{ src: p.original_url }}
                    />
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        minWidth: 26,
                        height: 26,
                        padding: 0,
                        borderRadius: '0 10px 0 10px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveUploadedPhoto(idx)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
              已上传 {uploadedPhotos.length} 张照片
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span style={{ fontWeight: 600 }}>批量复核</span>}
        open={batchReviewModalVisible}
        onOk={() => batchForm.submit()}
        onCancel={closeBatchReviewModal}
        className="app-modal"
      >
        <Form form={batchForm} onFinish={handleBatchReview} layout="vertical">
          <Form.Item
            name="conclusion"
            label={<span style={{ fontWeight: 500 }}>复核结论</span>}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item
            name="status_in_task"
            label={<span style={{ fontWeight: 500 }}>复核状态</span>}
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="passed">已通过</Radio>
              <Radio value="failed">未通过</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={<span style={{ fontWeight: 500 }}>上传照片</span>}>
            <Upload
              customRequest={handleUpload}
              beforeUpload={handleBeforeUpload}
              showUploadList={false}
              multiple
            >
              <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                上传照片
              </Button>
            </Upload>
            {uploadedPhotos.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {uploadedPhotos.map((p, idx) => (
                  <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                    <Image
                      src={p.thumbnail_url || p.original_url}
                      style={{
                        width: 88,
                        height: 88,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                      }}
                      preview={{ src: p.original_url }}
                    />
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        minWidth: 26,
                        height: 26,
                        padding: 0,
                        borderRadius: '0 10px 0 10px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveUploadedPhoto(idx)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
              已上传 {uploadedPhotos.length} 张照片
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskDetail
