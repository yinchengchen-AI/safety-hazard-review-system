"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/lib/userStore'
import request from '@/lib/api'

interface UserRow {
  id: string
  username: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string | null
}

export default function UsersPage() {
  const me = useUserStore((s) => s.user)
  const router = useRouter()
  const [items, setItems] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (me && me.role !== 'admin') router.push('/')
  }, [me, router])

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/users', { params: { page: 1, page_size: 50 } })) as { items: UserRow[]; total: number }
      setItems(r.items)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (me?.role === 'admin') load() }, [me])

  const onCreate = async () => {
    try {
      const v = await form.validateFields()
      await request.post('/users', v)
      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
    } catch (err: any) {
      message.error(err?.detail || '创建失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增用户</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'full_name' },
          { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v}</Tag> },
          { title: '状态', dataIndex: 'is_active', width: 100, render: (v: boolean) => v ? <Tag color="green">激活</Tag> : <Tag color="red">禁用</Tag> },
        ]}
      />
      <Modal title="新增用户" open={open} onCancel={() => setOpen(false)} onOk={onCreate} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 1, max: 50 }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="inspector">
            <Select options={[{ value: 'admin', label: '管理员' }, { value: 'inspector', label: '复核员' }]} />
          </Form.Item>
          <Form.Item name="full_name" label="姓名"><Input maxLength={100} /></Form.Item>
          <Form.Item name="phone" label="电话"><Input maxLength={20} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
