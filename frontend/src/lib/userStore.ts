import { create } from 'zustand'
import request from './api'

export interface User {
  id: string
  username: string
  role: string
  is_active: boolean
}

interface UserState {
  user: User | null
  isLoading: boolean
  fetchUser: () => Promise<void>
  clearUser: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  fetchUser: async () => {
    set({ isLoading: true })
    try {
      const data = (await request.get('/auth/me')) as User
      set({ user: data, isLoading: false })
    } catch {
      set({ user: null, isLoading: false })
    }
  },
  clearUser: () => set({ user: null, isLoading: false }),
}))
