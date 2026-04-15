import request from './request'

export const getHazards = (params: any) => request.get('/hazards', { params })
export const getHazard = (id: string) => request.get(`/hazards/${id}`)
export const getHazardEditableFields = (id: string) => request.get(`/hazards/${id}/editable`)
export const updateHazard = (id: string, data: any) => request.put(`/hazards/${id}`, data)
