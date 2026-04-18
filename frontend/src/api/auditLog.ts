import request from './request'

export interface AuditLogQuery {
  page?: number
  page_size?: number
  user_id?: string
  action?: string
  target_type?: string
  target_id?: string
  start_date?: string
  end_date?: string
}

export const getAuditLogs = (params: AuditLogQuery = {}) =>
  request.get('/audit-logs', { params })

export const getAuditLog = (id: string) =>
  request.get(`/audit-logs/${id}`)
