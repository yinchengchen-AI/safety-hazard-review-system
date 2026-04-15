import { Layout as AntLayout, Menu, Button } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Header, Sider, Content } = AntLayout

const menuItems = [
  { key: '/hazards', label: '隐患管理' },
  { key: '/batches/import', label: '批量导入' },
  { key: '/batches/history', label: '导入历史' },
  { key: '/tasks', label: '复核任务' },
  { key: '/statistics', label: '统计分析' },
  { key: '/users', label: '用户管理' },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 'bold' }}>安全生产隐患复核系统</div>
        <Button type="primary" danger onClick={handleLogout}>退出登录</Button>
      </Header>
      <AntLayout>
        <Sider theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Content style={{ margin: 16, padding: 16, background: '#fff' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
