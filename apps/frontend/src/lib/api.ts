import axios, { AxiosError } from 'axios'
import { useUserStore } from './userStore'

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api/v1',
  timeout: 30000,
  withCredentials: true,
})

let isRedirecting = false

request.interceptors.request.use((config) => config)

request.interceptors.response.use(
  (res) => res.data,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      const isLogin = error.config?.url?.endsWith('/auth/login')
      if (!isLogin && typeof window !== 'undefined' && !isRedirecting) {
        isRedirecting = true
        useUserStore.getState().clearUser()
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.join('; ')
    return error.message || '请求失败'
  }
  if (error instanceof Error) return error.message
  return '请求失败'
}

export default request
