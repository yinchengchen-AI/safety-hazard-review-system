"use client"
import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'
import { useUserStore } from '@/lib/userStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const router = useRouter()
  const fetchUser = useUserStore((s) => s.fetchUser)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      await fetchUser()
      router.push('/')
    } catch (err: any) {
      message.error(err?.detail || '登录失败')
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
        style={{ width: 420, borderRadius: 24, boxShadow: '0 20px 60px rgba(22,119,255,0.12)' }}
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
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
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
