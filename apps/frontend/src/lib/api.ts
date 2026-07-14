import axios, { AxiosError } from 'axios'
import { useUserStore } from './userStore'
import { translateDetail } from './errors'

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api/v1',
  timeout: 30000,
  withCredentials: true,
})

let isRedirecting = false

request.interceptors.request.use((config) => config)

request.interceptors.response.use(
  (res) => res.data,
  (error: AxiosError<{ detail?: unknown }>) => {
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

/**
 * Resolve a thrown value to a translated, human-readable string.
 * Works for axios errors (the common case) and arbitrary Error
 * instances (e.g. client-side exceptions during file parsing).
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: unknown; message?: unknown } | undefined
    if (data && data.detail !== undefined) {
      return translateDetail(data.detail) || error.message || '请求失败'
    }
    if (data && data.message !== undefined) {
      return translateDetail(data.message) || error.message || '请求失败'
    }
    return error.message || '请求失败'
  }
  if (error instanceof Error) return error.message
  return '请求失败'
}

export default request
