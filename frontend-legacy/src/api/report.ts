import request from './request'

export const generateReport = (taskId: string) =>
  request.post(`/reports/${taskId}/generate`)
export const getReportStatus = (taskId: string) =>
  request.get(`/reports/${taskId}/status`)
export const downloadReport = (taskId: string, format: string) =>
  request.get(`/reports/${taskId}/download?format=${format}`)
