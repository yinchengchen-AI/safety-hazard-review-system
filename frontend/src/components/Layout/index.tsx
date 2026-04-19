import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Layout as AntLayout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Badge,
  Spin,
  List,
  Empty,
} from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import {
  HomeOutlined,
  WarningOutlined,
  ImportOutlined,
  HistoryOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  TeamOutlined,
  LogoutOutlined,
  BellOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useUserStore } from '../../store/userStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { Notification } from '../../store/notificationStore'

const { Header, Sider, Content } = AntLayout

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/hazards', icon: <WarningOutlined />, label: '隐患管理' },
  { key: '/batches/import', icon: <ImportOutlined />, label: '批量导入' },
  { key: '/batches/history', icon: <HistoryOutlined />, label: '导入历史' },
  { key: '/tasks', icon: <FileSearchOutlined />, label: '复核任务' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
  { key: '/audit-logs', icon: <FileTextOutlined />, label: '操作日志', adminOnly: true },
  { key: '/enterprises', icon: <TeamOutlined />, label: '企业管理', adminOnly: true },
]

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUserStore()

  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const notifications = useNotificationStore((state) => state.notifications)
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const markRead = useNotificationStore((state) => state.markRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)

  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Ref-stable polling — avoids stale closure and infinite re-render
  const fetchUnreadCountRef = useRef(fetchUnreadCount)
  fetchUnreadCountRef.current = fetchUnreadCount

  useEffect(() => {
    fetchUnreadCountRef.current()
    const interval = setInterval(() => fetchUnreadCountRef.current(), 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch preview when dropdown opens
  const handleDropdownOpen = useCallback(
    (open: boolean) => {
      setDropdownOpen(open)
      if (open) {
        fetchNotifications(1, 5)
      }
    },
    [fetchNotifications]
  )

  // Navigate on click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead(notification.id)
    }
    if (notification.related_type === 'review_task' && notification.related_id) {
      navigate(`/tasks/${notification.related_id}`)
    } else if (notification.related_type === 'hazard' && notification.related_id) {
      navigate(`/hazards/${notification.related_id}`)
    } else if (notification.related_type === 'report' && notification.related_id) {
      navigate(`/tasks/${notification.related_id}`)
    }
    setDropdownOpen(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ]

  const dropdownContent = (
    <div
      style={{
        width: 360,
        maxHeight: 400,
        overflow: 'auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600 }}>通知</span>
        {unreadCount > 0 && (
          <span
            style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }}
            onClick={(e) => {
              e.stopPropagation()
              markAllRead()
              fetchUnreadCount()
            }}
          >
            全部已读
          </span>
        )}
      </div>
      <List
        dataSource={notifications}
        locale={{ emptyText: <Empty description="暂无通知" /> }}
        renderItem={(item: Notification) => (
          <List.Item
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              background: item.is_read ? '#fff' : '#f0f7ff',
            }}
            onClick={() => handleNotificationClick(item)}
          >
            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontSize: 14,
                  marginBottom: 4,
                  fontWeight: item.is_read ? 400 : 500,
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {formatRelativeTime(item.created_at)}
              </div>
            </div>
          </List.Item>
        )}
      />
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
        }}
      >
        <span
          style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }}
          onClick={() => {
            navigate('/notifications')
            setDropdownOpen(false)
          }}
        >
          查看全部
        </span>
      </div>
    </div>
  )

  return (
    <AntLayout className="app-layout" style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
              fontWeight: 'bold',
            }}
          >
            安
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
            安全生产隐患复核系统
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Dropdown
            open={dropdownOpen}
            onOpenChange={handleDropdownOpen}
            dropdownRender={() => dropdownContent}
            placement="bottomRight"
            trigger={['click']}
          >
            <Badge count={unreadCount} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>
          </Dropdown>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                {user?.username?.charAt(0) || '用'}
              </Avatar>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                {user?.username || '用户'}
              </span>
            </div>
          </Dropdown>
        </div>
      </Header>

      <AntLayout>
        <Sider width={200} theme="light">
          <div style={{ padding: '12px 0' }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems
                .filter((item) => !item.adminOnly || user?.role === 'admin')
                .map((item) => ({
                  key: item.key,
                  icon: item.icon,
                  label: item.label,
                  onClick: () => navigate(item.key),
                }))}
              style={{ borderRight: 'none' }}
            />
          </div>
        </Sider>

        <Content style={{ margin: 20, minHeight: 'calc(100vh - 104px)' }}>
          <div
            className="animate-fade-in-up delay-0"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              minHeight: '100%',
              padding: 24,
            }}
          >
            <Suspense
              fallback={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Spin size="large" tip="页面加载中..." />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
