import request from './request'

export const getTasks = () => request.get('/review-tasks')
export const getTask = (id: string) => request.get(`/review-tasks/${id}`)
export const createTask = (data: any) => request.post('/review-tasks', data)
export const removeHazardFromTask = (taskId: string, hazardId: string) =>
  request.delete(`/review-tasks/${taskId}/hazards/${hazardId}`)
export const reviewHazard = (taskId: string, hazardId: string, data: any) =>
  request.post(`/review-tasks/${taskId}/hazards/${hazardId}/review`, data)
export const batchReviewHazard = (taskId: string, data: any) =>
  request.post(`/review-tasks/${taskId}/batch-review`, data)
export const completeTask = (id: string) => request.post(`/review-tasks/${id}/complete`)
export const cancelTask = (id: string) => request.post(`/review-tasks/${id}/cancel`)
