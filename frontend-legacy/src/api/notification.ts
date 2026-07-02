import request from './request'

export const getNotifications = (page = 1, pageSize = 20) =>
  request.get(`/notifications?page=${page}&page_size=${pageSize}`) as Promise<any>

export const getUnreadCount = () =>
  request.get('/notifications/unread-count') as Promise<number>

export const markAsRead = (id: string) =>
  request.post(`/notifications/${id}/read`) as Promise<void>

export const markAllAsRead = () =>
  request.post('/notifications/read-all') as Promise<void>
