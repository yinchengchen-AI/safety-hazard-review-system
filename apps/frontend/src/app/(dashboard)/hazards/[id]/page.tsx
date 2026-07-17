"use client"

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Alert,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import request, { getErrorMessage } from '@/lib/api'
import { useUserStore } from '@/lib/userStore'

interface Hazard {
  id: string
  content: string | null
  description: string | null
  location: string | null
  category: string | null
  inspection_method: string | null
  inspector: string | null
  inspection_date: string | null
  judgment_basis: string | null
  violation_clause: string | null
  is_rectified: string | null
  rectification_date: string | null
  rectification_responsible: string | null
  rectification_measures: string | null
  report_remarks: string | null
  reporting_unit: string | null
  status: string
  current_task_id: string | null
  review_count: number
  created_at: string | null
  updated_at: string | null
  enterprise_name?: string | null
  batch_name?: string | null
}

interface EditableFields {
  description: boolean
  location: boolean
  category: boolean
  inspection_method: boolean
  inspector: boolean
  inspection_date: boolean
  judgment_basis: boolean
  violation_clause: boolean
  is_rectified: boolean
  rectification_date: boolean
  rectification_responsible: boolean
  rectification_measures: boolean
  report_remarks: boolean
  reporting_unit: boolean
}

interface UpdatePayload {
  description?: string
  location?: string
  category?: string
  inspection_method?: string
  inspector?: string
  inspection_date?: string
  judgment_basis?: string
  violation_clause?: string
  is_rectified?: '已整改' | '未整改' | '整改中'
  rectification_date?: string
  rectification_responsible?: string
  rectification_measures?: string
  report_remarks?: string
  reporting_unit?: string
}

export default function HazardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const [hazard, setHazard] = useState<Hazard | null>(null)
  const [editable, setEditable] = useState<EditableFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm<Record<string, unknown>>()

  const load = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    try {
      const [h, e] = await Promise.all([
        request.get(`/hazards/${id}`, { signal: controller?.signal }) as Promise<Hazard>,
        request.get(`/hazards/${id}/editable`, { signal: controller?.signal }) as Promise<EditableFields>,
      ])
      setHazard(h)
      setEditable(e)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
      message.error(getErrorMessage(err) || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    load(controller)
    return () => controller.abort()
  }, [load])

  const openEdit = () => {
    if (!hazard || !editable) return
    const initial: { [k: string]: unknown } = {
      description: hazard.description ?? '',
      location: hazard.location ?? '',
      category: hazard.category ?? '',
      inspection_method: hazard.inspection_method ?? '',
      inspector: hazard.inspector ?? '',
      inspection_date: hazard.inspection_date ? dayjs(hazard.inspection_date) : null,
      judgment_basis: hazard.judgment_basis ?? '',
      violation_clause: hazard.violation_clause ?? '',
      is_rectified: hazard.is_rectified ?? undefined,
      rectification_date: hazard.rectification_date ? dayjs(hazard.rectification_date) : null,
      rectification_responsible: hazard.rectification_responsible ?? '',
      rectification_measures: hazard.rectification_measures ?? '',
      report_remarks: hazard.report_remarks ?? '',
      reporting_unit: hazard.reporting_unit ?? '',
    }
    form.setFieldsValue(initial as never)
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!hazard) return
    try {
      const v = await form.validateFields()
      const payload: UpdatePayload = {}
      // Only include fields the backend will accept: ones that are
      // still null (editable) AND the user actually set a value.
      const isEditAllowed = (field: keyof EditableFields) => editable?.[field] === true
      const pick = (field: keyof EditableFields, value: unknown) => {
        if (value === '' || value === null || value === undefined) return
        if (!isEditAllowed(field)) return
        ;(payload as Record<string, unknown>)[field] = value
      }
      pick('description', v.description)
      pick('location', v.location)
      pick('category', v.category)
      pick('inspection_method', v.inspection_method)
      pick('inspector', v.inspector)
      pick('inspection_date', v.inspection_date ? (v.inspection_date as Dayjs).format('YYYY-MM-DD') : undefined)
      pick('judgment_basis', v.judgment_basis)
      pick('violation_clause', v.violation_clause)
      pick('is_rectified', v.is_rectified)
      pick('rectification_date', v.rectification_date ? (v.rectification_date as Dayjs).format('YYYY-MM-DD') : undefined)
      pick('rectification_responsible', v.rectification_responsible)
      pick('rectification_measures', v.rectification_measures)
      pick('report_remarks', v.report_remarks)
      pick('reporting_unit', v.reporting_unit)

      if (Object.keys(payload).length === 0) {
        message.warning('没有可更新的字段（已填写的字段不可修改）')
        return
      }
      await request.put(`/hazards/${id}`, payload)
      message.success('保存成功')
      setEditOpen(false)
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(getErrorMessage(err) || '保存失败')
    }
  }

  if (loading) return <Spin size="large" />
  if (!hazard) return <div>隐患不存在</div>

  const statusText = hazard.status === 'pending' ? '待复核' : hazard.status === 'passed' ? '已通过' : '未通过'
  const statusColor = hazard.status === 'pending' ? 'gold' : hazard.status === 'passed' ? 'green' : 'red'
  const isAdmin = user?.role === 'admin'
  const lockedInTask = !!hazard.current_task_id
  const editableFieldCount = editable ? Object.values(editable).filter(Boolean).length : 0

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/hazards')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card
        title="隐患详情"
        extra={
          isAdmin && !lockedInTask && editableFieldCount > 0 ? (
            <Button type="primary" icon={<EditOutlined />} onClick={openEdit}>
              编辑空缺字段
            </Button>
          ) : null
        }
      >
        {!isAdmin && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="仅管理员可编辑隐患字段"
          />
        )}
        {lockedInTask && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="该隐患已分配到复核任务，任务完成或取消前不可编辑"
          />
        )}
        {isAdmin && !lockedInTask && editableFieldCount === 0 && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message="所有可编辑字段都已填写"
          />
        )}
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="ID">{hazard.id}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColor}>{statusText}</Tag></Descriptions.Item>
          <Descriptions.Item label="企业">{hazard.enterprise_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="批次">{hazard.batch_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="上报单位">{hazard.reporting_unit || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患分类">{hazard.category || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患位置">{hazard.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查方式">{hazard.inspection_method || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查人">{hazard.inspector || '-'}</Descriptions.Item>
          <Descriptions.Item label="检查时间">{hazard.inspection_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="是否整改">{hazard.is_rectified || '-'}</Descriptions.Item>
          <Descriptions.Item label="整改完成时间">{hazard.rectification_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="整改责任人">{hazard.rectification_responsible || '-'}</Descriptions.Item>
          <Descriptions.Item label="复核次数">{hazard.review_count}</Descriptions.Item>
          <Descriptions.Item label="当前复核任务">{hazard.current_task_id || '-'}</Descriptions.Item>
          <Descriptions.Item label="隐患描述" span={{ xs: 1, sm: 2 }}>
            {hazard.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="判定依据" span={{ xs: 1, sm: 2 }}>
            {hazard.judgment_basis || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="违反条款" span={{ xs: 1, sm: 2 }}>
            {hazard.violation_clause || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="整改措施" span={{ xs: 1, sm: 2 }}>
            {hazard.rectification_measures || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="举报情况备注" span={{ xs: 1, sm: 2 }}>
            {hazard.report_remarks || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{hazard.created_at ? new Date(hazard.created_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{hazard.updated_at ? new Date(hazard.updated_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        title="编辑空缺字段"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={submitEdit}
        okText="保存"
        cancelText="取消"
        width="min(680px, calc(100vw - 32px))"
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="已填写过的字段无法再次修改；只有空缺的字段才能保存。"
        />
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="description" label="隐患描述" rules={[{ max: 2000 }]}>
            <Input.TextArea rows={3} maxLength={2000} disabled={!editable?.description} placeholder={editable?.description ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="location" label="隐患位置" rules={[{ max: 255 }]}>
            <Input maxLength={255} disabled={!editable?.location} placeholder={editable?.location ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="category" label="隐患分类" rules={[{ max: 50 }]}>
            <Input maxLength={50} disabled={!editable?.category} placeholder={editable?.category ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="inspection_method" label="检查方式" rules={[{ max: 50 }]}>
            <Input maxLength={50} disabled={!editable?.inspection_method} placeholder={editable?.inspection_method ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="inspector" label="检查人" rules={[{ max: 100 }]}>
            <Input maxLength={100} disabled={!editable?.inspector} placeholder={editable?.inspector ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="inspection_date" label="检查时间">
            <DatePicker
              style={{ width: '100%' }}
              disabled={!editable?.inspection_date}
              format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item name="judgment_basis" label="判定依据" rules={[{ max: 500 }]}>
            <Input.TextArea rows={2} maxLength={500} disabled={!editable?.judgment_basis} placeholder={editable?.judgment_basis ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="violation_clause" label="违反条款">
            <Input.TextArea rows={2} disabled={!editable?.violation_clause} placeholder={editable?.violation_clause ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="is_rectified" label="是否整改">
            <Select
              allowClear
              disabled={!editable?.is_rectified}
              placeholder={editable?.is_rectified ? '请选择' : '已有值，不可修改'}
              options={[
                { value: '已整改', label: '已整改' },
                { value: '未整改', label: '未整改' },
                { value: '整改中', label: '整改中' },
              ]}
            />
          </Form.Item>
          <Form.Item name="rectification_date" label="整改完成时间">
            <DatePicker
              style={{ width: '100%' }}
              disabled={!editable?.rectification_date}
              format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item name="rectification_responsible" label="整改责任人" rules={[{ max: 200 }]}>
            <Input maxLength={200} disabled={!editable?.rectification_responsible} placeholder={editable?.rectification_responsible ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="rectification_measures" label="整改措施">
            <Input.TextArea rows={2} disabled={!editable?.rectification_measures} placeholder={editable?.rectification_measures ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="report_remarks" label="举报情况备注">
            <Input.TextArea rows={2} disabled={!editable?.report_remarks} placeholder={editable?.report_remarks ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
          <Form.Item name="reporting_unit" label="上报单位" rules={[{ max: 100 }]}>
            <Input maxLength={100} disabled={!editable?.reporting_unit} placeholder={editable?.reporting_unit ? '请输入' : '已有值，不可修改'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
