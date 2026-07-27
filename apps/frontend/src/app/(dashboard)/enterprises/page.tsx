"use client"
import { useEffect, useState } from 'react'
import { Table, Button, message, Modal, Form, Input, Popconfirm, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useUserStore } from '@/lib/userStore'
import request, { getErrorMessage } from '@/lib/api'

interface Enterprise {
  id: string
  name: string
  credit_code: string | null
  region: string | null
  address: string | null
  contact_person: string | null
  industry_sector: string | null
  enterprise_type: string | null
}

interface EnterpriseFormValues {
  name: string
  credit_code?: string
  region?: string
  address?: string
  contact_person?: string
  industry_sector?: string
  enterprise_type?: string
}

export default function EnterprisesPage() {
  const user = useUserStore((s) => s.user)
  const [items, setItems] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Enterprise | null>(null)
  const [form] = Form.useForm<EnterpriseFormValues>()

  const load = async (controller?: AbortController) => {
    setLoading(true)
    try {
      const r = (await request.get('/enterprises', { params: { page: 1, page_size: 50 }, signal: controller?.signal })) as { items: Enterprise[]; total: number }
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

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (r: Enterprise) => {
    setEditing(r)
    form.setFieldsValue({
      name: r.name,
      credit_code: r.credit_code ?? undefined,
      region: r.region ?? undefined,
      address: r.address ?? undefined,
      contact_person: r.contact_person ?? undefined,
      industry_sector: r.industry_sector ?? undefined,
      enterprise_type: r.enterprise_type ?? undefined,
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const onSubmit = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      if (editing) {
        await request.put(`/enterprises/${editing.id}`, v)
        message.success('保存成功')
      } else {
        await request.post('/enterprises', v)
        message.success('创建成功')
      }
      closeModal()
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || (editing ? '保存失败' : '创建失败'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (r: Enterprise) => {
    try {
      await request.delete(`/enterprises/${r.id}`)
      message.success('删除成功')
      load()
    } catch (err: any) {
      message.error(getErrorMessage(err) || '删除失败')
    }
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div className="dashboard-toolbar">
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增企业</Button>}
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
            { title: '名称', dataIndex: 'name' },
            { title: '统一社会信用代码', dataIndex: 'credit_code', width: 200 },
            { title: '属地', dataIndex: 'region', width: 120 },
            { title: '负责人', dataIndex: 'contact_person', width: 120 },
            { title: '行业领域', dataIndex: 'industry_sector', width: 120 },
            ...(isAdmin ? [{
              title: '操作', width: 140, fixed: 'right' as const,
              render: (_: unknown, r: Enterprise) => (
                <Space size={4}>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Popconfirm
                    title={`确认删除企业「${r.name}」？`}
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => onDelete(r)}
                  >
                    <Button type="link" size="small" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            }] : []),
          ]}
        />
      </div>
      <Modal
        width="min(520px, calc(100vw - 32px))"
        title={editing ? '编辑企业' : '新增企业'}
        open={open}
        onCancel={closeModal}
        onOk={onSubmit}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
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
