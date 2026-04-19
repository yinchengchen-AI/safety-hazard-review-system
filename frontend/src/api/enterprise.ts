import request from './request'

export interface Enterprise {
  id: string
  name: string
  credit_code: string | null
  region: string | null
  address: string | null
  contact_person: string | null
  industry_sector: string | null
  enterprise_type: string | null
  created_at: string
}

export interface EnterpriseCreate {
  name: string
  credit_code?: string
  region?: string
  address?: string
  contact_person?: string
  industry_sector?: string
  enterprise_type?: string
}

export interface EnterpriseUpdate {
  name?: string
  credit_code?: string
  region?: string
  address?: string
  contact_person?: string
  industry_sector?: string
  enterprise_type?: string
}

export interface EnterpriseListResponse {
  items: Enterprise[]
  total: number
}

export const getEnterprises = (params: { page?: number; page_size?: number; keyword?: string }) =>
  request.get('/enterprises', { params }) as Promise<EnterpriseListResponse>

export const getEnterprise = (id: string) =>
  request.get(`/enterprises/${id}`) as Promise<Enterprise>

export const createEnterprise = (data: EnterpriseCreate) =>
  request.post('/enterprises', data) as Promise<Enterprise>

export const updateEnterprise = (id: string, data: EnterpriseUpdate) =>
  request.put(`/enterprises/${id}`, data) as Promise<Enterprise>

export const deleteEnterprise = (id: string) =>
  request.delete(`/enterprises/${id}`) as Promise<void>

export const importEnterprises = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/enterprises/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }) as Promise<{ success_count: number; error_count: number; errors: string[] }>
}

export const exportEnterprises = () =>
  request.get('/enterprises/export', { responseType: 'blob' }) as Promise<Blob>

export const getEnterpriseStatistics = (id: string) =>
  request.get(`/enterprises/${id}/statistics`) as Promise<any>

export const getEnterpriseTemplate = () =>
  request.get('/enterprises/template', { responseType: 'blob' }) as Promise<Blob>
