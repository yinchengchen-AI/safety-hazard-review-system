"use client"
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import request from '@/lib/api'
import { getErrorMessage } from '@/lib/api'
import { useUserStore } from '@/lib/userStore'

interface UserRow {
  id: string
  username: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string | null
}

interface CreateUserFormValues {
  username: string
  password: string
  confirm_password: string
  role: 'admin' | 'inspector'
  full_name?: string
  phone?: string
}

interface ResetPasswordFormValues {
  new_password: string
  confirm_password: string
}

export default function UsersPage() {
  const me = useUserStore((s) => s.user)
  const [items, setItems] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [resetting, setResetting] = useState(false)
  const [form] = Form.useForm<CreateUserFormValues>()
  const [resetForm] = Form.useForm<ResetPasswordFormValues>()

  const load = async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/users', { params: { page: 1, page_size: 50 }, signal: controller?.signal })) as { items: UserRow[]; total: number }
      setItems(r.items)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [])

  const onCreate = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      await request.post('/users', {
        username: v.username,
        password: v.password,
        role: v.role,
        full_name: v.full_name,
        phone: v.phone,
      })
      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (r: UserRow) => {
    try {
      await request.put(`/users/${r.id}`, { is_active: !r.is_active })
      message.success(r.is_active ? '已停用该用户' : '已启用该用户')
      load()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  const toggleRole = async (r: UserRow) => {
    const nextRole = r.role === 'admin' ? 'inspector' : 'admin'
    try {
      await request.put(`/users/${r.id}`, { role: nextRole })
      message.success('角色已更新')
      load()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '操作失败')
    }
  }

  const openReset = (r: UserRow) => {
    setResetTarget(r)
    resetForm.resetFields()
  }

  const onResetPassword = async () => {
    if (!resetTarget) return
    try {
      const v = await resetForm.validateFields()
      setResetting(true)
      await request.post(`/users/${resetTarget.id}/reset-password`, { new_password: v.new_password })
      message.success(`已重置用户「${resetTarget.username}」的密码`)
      setResetTarget(null)
      resetForm.resetFields()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '重置失败')
    } finally {
      setResetting(false)
    }
  }

  const passwordConfirmRule = (field: string) => ({ getFieldValue }: { getFieldValue: (name: string) => string }) => ({
    validator(_: unknown, value: string) {
      if (!value || getFieldValue(field) === value) return Promise.resolve()
      return Promise.reject(new Error('两次输入的密码不一致'))
    },
  })

  return (
    <div>
      <div className="dashboard-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增用户</Button>
      </div>
      <div className="dashboard-table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          size="middle"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '用户名', dataIndex: 'username' },
            { title: '姓名', dataIndex: 'full_name' },
            { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v === 'admin' ? '管理员' : '复核员'}</Tag> },
            { title: '状态', dataIndex: 'is_active', width: 100, render: (v: boolean) => v ? <Tag color="green">激活</Tag> : <Tag color="red">禁用</Tag> },
            {
              title: '操作', width: 260, fixed: 'right',
              render: (_: unknown, r: UserRow) => {
                const isSelf = me?.id === r.id
                return (
                  <Space size={4} wrap>
                    <Tooltip title={isSelf ? '不能停用自己的账号' : undefined}>
                      <span>
                        <Popconfirm
                          title={r.is_active ? `确认停用用户「${r.username}」？` : `确认启用用户「${r.username}」？`}
                          okText="确认"
                          cancelText="取消"
                          onConfirm={() => toggleActive(r)}
                        >
                          <Button type="link" size="small" disabled={isSelf}>
                            {r.is_active ? '停用' : '启用'}
                          </Button>
                        </Popconfirm>
                      </span>
                    </Tooltip>
                    <Tooltip title={isSelf ? '不能修改自己的角色' : undefined}>
                      <span>
                        <Popconfirm
                          title={r.role === 'admin' ? `确认将「${r.username}」改为复核员？` : `确认将「${r.username}」设为管理员？`}
                          okText="确认"
                          cancelText="取消"
                          onConfirm={() => toggleRole(r)}
                        >
                          <Button type="link" size="small" disabled={isSelf}>
                            {r.role === 'admin' ? '设为复核员' : '设为管理员'}
                          </Button>
                        </Popconfirm>
                      </span>
                    </Tooltip>
                    <Tooltip title={isSelf ? '不能重置自己的密码' : undefined}>
                      <span>
                        <Button type="link" size="small" disabled={isSelf} onClick={() => openReset(r)}>
                          重置密码
                        </Button>
                      </span>
                    </Tooltip>
                  </Space>
                )
              },
            },
          ]}
        />
      </div>
      <Modal
        width="min(520px, calc(100vw - 32px))"
        title="新增用户"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 1, max: 50 }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              passwordConfirmRule('password'),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="inspector">
            <Select options={[{ value: 'admin', label: '管理员' }, { value: 'inspector', label: '复核员' }]} />
          </Form.Item>
          <Form.Item name="full_name" label="姓名"><Input maxLength={100} /></Form.Item>
          <Form.Item name="phone" label="电话"><Input maxLength={20} /></Form.Item>
        </Form>
      </Modal>
      <Modal
        width="min(520px, calc(100vw - 32px))"
        title={resetTarget ? `重置密码：${resetTarget.username}` : '重置密码'}
        open={!!resetTarget}
        onCancel={() => { setResetTarget(null); resetForm.resetFields() }}
        onOk={onResetPassword}
        okText="重置"
        cancelText="取消"
        confirmLoading={resetting}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical" preserve={false}>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              passwordConfirmRule('new_password'),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
