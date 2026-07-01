"use client"
import { useEffect, useState, useRef, useCallback } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Badge, List, Empty, Breadcrumb } from 'antd'
import {
  HomeOutlined,
  WarningOutlined,
  ImportOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  LogoutOutlined,
  BellOutlined,
  TeamOutlined,
  ShopOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { useUserStore } from '@/lib/userStore'
import { useNotificationStore, AppNotification } from '@/lib/notificationStore'
import { logout as apiLogout } from '@/lib/auth'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/hazards', icon: <WarningOutlined />, label: '隐患管理' },
  {
    key: 'batches',
    icon: <ImportOutlined />,
    label: '批量管理',
    children: [
      { key: '/batches/import', label: '批量导入' },
      { key: '/batches/history', label: '导入历史' },
    ],
  },
  { key: '/tasks', icon: <FileSearchOutlined />, label: '复核任务' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
  {
    key: 'system',
    icon: <TeamOutlined />,
    label: '系统管理',
    adminOnly: true,
    children: [
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/enterprises', icon: <ShopOutlined />, label: '企业管理' },
      { key: '/audit-logs', icon: <FileTextOutlined />, label: '操作日志' },
    ],
  },
]

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  const days = Math.floor(h / 24)
  if (days < 7) return days + '天前'
  return d.toLocaleDateString('zh-CN')
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearUser, fetchUser } = useUserStore()
  const { unreadCount, notifications, fetchUnreadCount, fetchNotifications, markRead, markAllRead } =
    useNotificationStore()
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const fetchUnreadRef = useRef(fetchUnreadCount)
  fetchUnreadRef.current = fetchUnreadCount
  useEffect(() => {
    fetchUnreadRef.current()
    const id = setInterval(() => fetchUnreadRef.current(), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])
  useEffect(() => {
    const next: string[] = []
    if (pathname.startsWith('/batches/')) next.push('batches')
    if (['/users', '/enterprises', '/audit-logs'].includes(pathname)) next.push('system')
    setOpenKeys(next)
  }, [pathname])

  const handleDropdownOpen = useCallback(
    (open: boolean) => {
      setDropdownOpen(open)
      if (open) fetchNotifications(1, 5)
    },
    [fetchNotifications],
  )

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id)
    if (n.related_type === 'review_task' && n.related_id) {
      router.push(`/tasks/${n.related_id}`)
    } else if (n.related_type === 'hazard' && n.related_id) {
      router.push(`/hazards/${n.related_id}`)
    } else if (n.related_type === 'report' && n.related_id) {
      router.push(`/tasks/${n.related_id}`)
    }
    setDropdownOpen(false)
  }

  const handleLogout = async () => {
    try { await apiLogout() } catch { /* ignore */ }
    clearUser()
    router.push('/login')
  }

  const userMenu = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout, danger: true },
  ]

  const visibleMenu = menuItems.filter((m) => !m.adminOnly || user?.role === 'admin')
  const items = visibleMenu.map((m) =>
    m.children
      ? {
          key: m.key,
          icon: m.icon,
          label: m.label,
          children: m.children.map((c) => ({ key: c.key, label: c.label, onClick: () => router.push(c.key) })),
        }
      : { key: m.key, icon: m.icon, label: m.label, onClick: () => router.push(m.key) },
  )

  const dropdown = (
    <div style={{ width: 360, maxHeight: 400, overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>通知</span>
        {unreadCount > 0 && (
          <span style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); markAllRead() }}>
            全部已读
          </span>
        )}
      </div>
      <List
        dataSource={notifications}
        locale={{ emptyText: <Empty description="暂无通知" /> }}
        renderItem={(n) => (
          <List.Item style={{ padding: '10px 16px', cursor: 'pointer', background: n.is_read ? '#fff' : '#f0f7ff' }} onClick={() => handleNotificationClick(n)}>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 14, marginBottom: 4, fontWeight: n.is_read ? 400 : 500 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{formatRelative(n.created_at)}</div>
            </div>
          </List.Item>
        )}
      />
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <span style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }} onClick={() => { router.push('/notifications'); setDropdownOpen(false) }}>
          查看全部
        </span>
      </div>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} theme="light" width={200} collapsedWidth={80} style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 10 }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10, padding: collapsed ? 0 : '0 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 'bold', flexShrink: 0 }}>安</div>
          {!collapsed && <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' }}>隐患复核系</div>}
        </div>
        <div style={{ padding: '12px 0' }}>
          <Menu mode="inline" selectedKeys={[pathname]} openKeys={openKeys} onOpenChange={setOpenKeys} items={items} style={{ borderRight: 'none' }} />
        </div>
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 200, marginLeft: collapsed ? 80 : 200, marginRight: 20, width: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 16, width: 36, height: 36, flexShrink: 0 }} />
            <Breadcrumb
              items={[{ title: pathname === '/' ? '首页' : pathname.split('/').filter(Boolean).join(' / ') }]}
              style={{ marginLeft: 8 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <Dropdown open={dropdownOpen} onOpenChange={handleDropdownOpen} dropdownRender={() => dropdown} placement="bottomRight" trigger={['click']}>
              <Badge count={unreadCount} size="small">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Dropdown>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Avatar style={{ background: '#1677ff' }}>{user?.username?.charAt(0) || '用'}</Avatar>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{user?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 20, marginLeft: collapsed ? 100 : 220, minHeight: 'calc(100vh - 104px)' }}>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', minHeight: '100%', padding: 24 }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
