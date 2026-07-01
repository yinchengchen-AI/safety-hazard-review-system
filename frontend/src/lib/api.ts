import axios from 'axios'

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api/v1',
  timeout: 30000,
  withCredentials: true,
})

request.interceptors.request.use((config) => config)

request.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      const isLogin = error.config?.url?.endsWith('/auth/login')
      if (!isLogin && typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default request
