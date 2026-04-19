import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Card,
  Tag,
  Empty,
  message,
  Typography,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { CheckOutlined } from '@ant-design/icons'
import {
  useNotificationStore,
  type Notification,
} from '../../store/notificationStore'

const { Title, Text } = Typography

const typeMap: Record<string, string> = {
  task_created: '任务创建',
  task_completed: '任务完成',
  task_cancelled: '任务取消',
  hazard_reviewed: '隐患复核',
  report_completed: '报告生成',
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NotificationList() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  const notifications = useNotificationStore((state) => state.notifications)
  const total = useNotificationStore((state) => state.total)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const fetchNotifications = useNotificationStore(
    (state) => state.fetchNotifications
  )
  const markRead = useNotificationStore((state) => state.markRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)

  useEffect(() => {
    fetchNotifications(currentPage, pageSize)
  }, [currentPage, pageSize, fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      message.success('已全部标记为已读')
      fetchNotifications(currentPage, pageSize)
    } catch {
      message.error('操作失败')
    }
  }

  const handleRowClick = (record: Notification) => {
    if (!record.is_read) {
      markRead(record.id)
    }
    if (record.related_type === 'review_task' && record.related_id) {
      navigate(`/tasks/${record.related_id}`)
    } else if (record.related_type === 'hazard' && record.related_id) {
      navigate(`/hazards/${record.related_id}`)
    } else if (record.related_type === 'report' && record.related_id) {
      navigate(`/tasks/${record.related_id}`)
    }
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Notification) => (
        <span style={{ fontWeight: record.is_read ? 400 : 600 }}>{title}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{typeMap[type] || type}</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (created_at: string) => formatTime(created_at),
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 100,
      render: (is_read: boolean) =>
        is_read ? (
          <Tag color="default">已读</Tag>
        ) : (
          <Tag color="red">未读</Tag>
        ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div
        className="app-card animate-fade-in-up delay-0"
        style={{
          marginBottom: 20,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            通知中心
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            查看和管理系统通知
          </Text>
        </div>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleMarkAllRead}
        >
          全部标记为已读
        </Button>
      </div>

      <Card
        className="app-card app-table animate-fade-in-up delay-1"
        title={<span style={{ fontWeight: 600, fontSize: 16 }}>通知列表</span>}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={notifications}
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page) => setCurrentPage(page),
          }}
          locale={{
            emptyText: <Empty description="暂无通知" />,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          style={{ padding: '0 20px 20px' }}
        />
      </Card>
    </div>
  )
}

export default NotificationList
