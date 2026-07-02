import { create } from 'zustand'
import request from './api'

export interface AppNotification {
  id: string
  type: string
  title: string
  content: string | null
  related_type: string | null
  related_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

interface NotificationState {
  unreadCount: number
  notifications: AppNotification[]
  total: number
  isLoading: boolean
  fetchUnreadCount: () => Promise<void>
  fetchNotifications: (page?: number, pageSize?: number) => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  total: 0,
  isLoading: false,
  fetchUnreadCount: async () => {
    try {
      const res = (await request.get('/notifications/unread-count')) as { count: number }
      set({ unreadCount: res.count })
    } catch {
      // ignore
    }
  },
  fetchNotifications: async (page = 1, pageSize = 20) => {
    set({ isLoading: true })
    try {
      const data = (await request.get(`/notifications?page=${page}&page_size=${pageSize}`)) as {
        items: AppNotification[]
        total: number
        unread_count: number
      }
      set({
        notifications: data.items || [],
        total: data.total || 0,
        unreadCount: data.unread_count || 0,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },
  markRead: async (id: string) => {
    await request.post(`/notifications/${id}/read`)
    set({ unreadCount: Math.max(0, get().unreadCount - 1) })
  },
  markAllRead: async () => {
    await request.post('/notifications/read-all')
    set({ unreadCount: 0 })
  },
}))
