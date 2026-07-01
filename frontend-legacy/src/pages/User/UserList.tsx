import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, message, Modal, Form, Input, Select, Pagination } from 'antd'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../../api/user'

const roleMap: Record<string, { color: string; text: string }> = {
  admin: { color: 'red', text: '管理员' },
  inspector: { color: 'blue', text: '检查员' },
}

function UserList() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [form] = Form.useForm()

  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetForm] = Form.useForm()

  const fetchData = async (currentPage = page, search = keyword) => {
    setLoading(true)
    try {
      const res: any = await getUsers({ page: currentPage, page_size: pageSize, keyword: search })
      setData(res.items || [])
      setTotal(res.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearch = () => {
    setPage(1)
    fetchData(1, keyword)
  }

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
    fetchData(newPage, keyword)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEditModal = (record: any) => {
    setEditingUser(record)
    form.setFieldsValue({ username: record.username, role: record.role, full_name: record.full_name, phone: record.phone })
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingUser) {
        const payload: any = { role: values.role, full_name: values.full_name, phone: values.phone }
        if (values.password) {
          payload.password = values.password
        }
        await updateUser(editingUser.id, payload)
        message.success('更新成功')
      } else {
        await createUser(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData(page, keyword)
    } catch (err: any) {
      message.error(err.detail || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后该用户将无法登录，是否继续？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(id)
          message.success('删除成功')
          fetchData(page, keyword)
        } catch (err: any) {
          message.error(err.detail || '删除失败')
        }
      },
    })
  }

  const openResetModal = (record: any) => {
    setResetUserId(record.id)
    resetForm.resetFields()
    setResetModalVisible(true)
  }

  const handleResetOk = async () => {
    try {
      const values = await resetForm.validateFields()
      if (resetUserId) {
        await resetPassword(resetUserId, { new_password: values.new_password })
        message.success('密码重置成功')
        setResetModalVisible(false)
      }
    } catch (err: any) {
      message.error(err.detail || '操作失败')
    }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleMap[role]?.color}>{roleMap[role]?.text}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" onClick={() => openResetModal(record)}>重置密码</Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div
        className="app-card"
        style={{
          marginBottom: 24,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            用户管理
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            管理系统用户账号、角色及密码
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input
            placeholder="搜索用户名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240, borderRadius: 'var(--radius-md)' }}
          />
          <Button onClick={handleSearch} style={{ borderRadius: 'var(--radius-md)' }}>搜索</Button>
          <Button type="primary" onClick={openCreateModal} style={{ borderRadius: 'var(--radius-md)' }}>新增用户</Button>
        </div>
      </div>

      <div className="app-card app-table animate-fade-in-up delay-1" style={{ padding: 20 }}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            style={{ marginTop: 16, textAlign: 'right' }}
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </div>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        className="app-modal"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input disabled={!!editingUser} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="inspector">检查员</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="full_name"
            label="姓名"
          >
            <Input placeholder="姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="联系电话"
          >
            <Input placeholder="联系电话" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? '密码（留空则不修改）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={resetModalVisible}
        onOk={handleResetOk}
        onCancel={() => setResetModalVisible(false)}
        destroyOnClose
        className="app-modal"
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserList
