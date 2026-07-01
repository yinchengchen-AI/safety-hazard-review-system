import { create } from 'zustand'
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '../api/notification'

export interface Notification {
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
  notifications: Notification[]
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
      const count = await getUnreadCount()
      set({ unreadCount: count })
    } catch {
      // ignore
    }
  },

  fetchNotifications: async (page = 1, pageSize = 20) => {
    set({ isLoading: true })
    try {
      const data = await getNotifications(page, pageSize)
      set({
        notifications: data.items || [],
        total: data.total || 0,
        unreadCount: data.unread_count || 0,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  markRead: async (id: string) => {
    await markAsRead(id)
    set({ unreadCount: Math.max(0, get().unreadCount - 1) })
  },

  markAllRead: async () => {
    await markAllAsRead()
    set({ unreadCount: 0 })
  },
}))
