import { create } from 'zustand'
import request from '../api/request'

interface User {
  id: string
  username: string
  role: string
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
    const token = localStorage.getItem('token')
    if (!token) {
      set({ user: null, isLoading: false })
      return
    }

    set({ isLoading: true })
    try {
      const data = await request.get('/auth/me') as User
      set({ user: data, isLoading: false })
    } catch (error) {
      set({ user: null, isLoading: false })
    }
  },

  clearUser: () => {
    set({ user: null, isLoading: false })
  },
}))
