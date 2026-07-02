import request from './request'

export const getBatches = (params?: { page?: number; page_size?: number }) =>
  request.get('/batches', { params }) as Promise<any>

export const previewImport = (formData: FormData) =>
  request.post('/batches/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const importHazards = (formData: FormData) =>
  request.post('/batches/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const getImportErrors = (batchId: string) =>
  request.get(`/batches/${batchId}/errors`) as Promise<any[]>

export const downloadBatchFile = (batchId: string) =>
  request.get(`/batches/${batchId}/download`, { responseType: 'blob' }) as Promise<Blob>

export const deleteBatch = (batchId: string) =>
  request.delete(`/batches/${batchId}`)

export const downloadTemplate = (format: 'excel' | 'csv') =>
  request.get(`/batches/template?format=${format}`, { responseType: 'blob' }) as Promise<Blob>
