import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Badge, Spin } from 'antd'
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
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUserStore()

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
          <Badge dot>
            <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
          </Badge>
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
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" tip="页面加载中..." /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
