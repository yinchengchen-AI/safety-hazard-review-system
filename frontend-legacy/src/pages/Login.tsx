import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { login } from '../api/auth'

const { Title, Text } = Typography

function Login({ onLogin }: { onLogin?: () => void }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res: any = await login(values.username, values.password)
      localStorage.setItem('token', res.access_token)
      message.success('登录成功')
      onLogin?.()
      navigate('/')
    } catch (err: any) {
      message.error(err.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 50%, #f6ffed 100%)',
        padding: 24,
      }}
    >
      <Card
        className="animate-scale-in delay-0"
        style={{
          width: 420,
          borderRadius: 24,
          border: '1px solid rgba(22,119,255,0.08)',
          boxShadow: '0 20px 60px rgba(22,119,255,0.12)',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: '40px 36px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 32,
              marginBottom: 20,
              boxShadow: '0 8px 24px rgba(22,119,255,0.3)',
            }}
          >
            <SafetyOutlined />
          </div>
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            安全生产隐患复核系统
          </Title>
          <Text type="secondary">欢迎回来，请登录您的账号</Text>
        </div>

        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
              placeholder="用户名"
              style={{ borderRadius: 12, height: 46 }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
              placeholder="密码"
              style={{ borderRadius: 12, height: 46 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                borderRadius: 12,
                height: 46,
                fontSize: 16,
                fontWeight: 500,
                boxShadow: '0 4px 14px rgba(22,119,255,0.35)',
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            默认管理员账号：admin / admin123
          </Text>
        </div>
      </Card>
    </div>
  )
}

export default Login
