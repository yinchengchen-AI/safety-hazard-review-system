"use client"
import { useEffect, useState } from 'react'
import { Table, Button, Space, message, Modal, Form, Input, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useUserStore } from '@/lib/userStore'
import request from '@/lib/api'

interface Enterprise {
  id: string
  name: string
  credit_code: string | null
  region: string | null
  contact_person: string | null
  industry_sector: string | null
}

export default function EnterprisesPage() {
  const user = useUserStore((s) => s.user)
  const [items, setItems] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const r = (await request.get('/enterprises', { params: { page: 1, page_size: 50 } })) as { items: Enterprise[]; total: number }
      setItems(r.items)
    } catch (err: any) {
      message.error(err?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load() }, [])

  const onCreate = async () => {
    try {
      const v = await form.validateFields()
      await request.post('/enterprises', v)
      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
    } catch (err: any) {
      message.error(err?.detail || '创建失败')
    }
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增企业</Button>}
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '统一社会信用代码', dataIndex: 'credit_code', width: 200 },
          { title: '属地', dataIndex: 'region', width: 120 },
          { title: '负责人', dataIndex: 'contact_person', width: 120 },
          { title: '行业领域', dataIndex: 'industry_sector', width: 120 },
        ]}
      />
      <Modal title="新增企业" open={open} onCancel={() => setOpen(false)} onOk={onCreate} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="企业名称" rules={[{ required: true, max: 200 }]}><Input /></Form.Item>
          <Form.Item name="credit_code" label="统一社会信用代码"><Input maxLength={50} /></Form.Item>
          <Form.Item name="region" label="属地"><Input maxLength={100} /></Form.Item>
          <Form.Item name="address" label="详细地址"><Input maxLength={500} /></Form.Item>
          <Form.Item name="contact_person" label="负责人"><Input maxLength={100} /></Form.Item>
          <Form.Item name="industry_sector" label="行业领域"><Input maxLength={100} /></Form.Item>
          <Form.Item name="enterprise_type" label="企业类型"><Input maxLength={50} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
