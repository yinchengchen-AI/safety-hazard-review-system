import request from './request'

export interface HazardListResponse {
  items: any[]
  total: number
}

export const getHazards = (params: any): Promise<HazardListResponse> =>
  request.get('/hazards', { params }).then((res: any) => res.data || res)
export const getHazard = (id: string) => request.get(`/hazards/${id}`)
export const getHazardEditableFields = (id: string) => request.get(`/hazards/${id}/editable`)
export const updateHazard = (id: string, data: any) => request.put(`/hazards/${id}`, data)
