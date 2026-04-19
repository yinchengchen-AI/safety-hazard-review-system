import axios from 'axios'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// 英文错误消息 → 中文映射
const errorMessageMap: Record<string, string> = {
  'Incorrect username or password': '用户名或密码错误',
  'Username already exists': '用户名已存在',
  'User not found': '用户不存在',
  'Enterprise not found': '企业不存在',
  'Hazard not found': '隐患不存在',
  'Photo not found': '照片不存在',
  'Report not found': '报告不存在',
  'Report not ready': '报告尚未生成',
  'Review task not found': '复核任务不存在',
  'Task hazard not found': '任务隐患不存在',
  'Notification not found': '通知不存在',
  'Audit log not found': '审计日志不存在',
  'Only pending tasks can be reviewed': '仅待复核的任务可进行复核',
  'Only pending tasks can be modified': '仅待复核的任务可修改',
  'Only pending tasks can be completed': '仅待复核的任务可完成',
  'Cannot delete photo from a completed or cancelled task': '已完成或已取消的任务不能删除照片',
  'No hazards selected': '未选择隐患',
  'Some hazards not found': '部分隐患不存在',
  'Hazard not in this task': '隐患不在此任务中',
  'File size exceeds 10MB limit': '文件大小超过10MB限制',
  'Invalid file type': '无效的文件类型',
  'File header does not match allowed image formats': '文件头与允许的图像格式不匹配',
  'Invalid image file': '无效的图片文件',
  'Image dimensions out of allowed range': '图片尺寸超出允许范围',
}

function translateError(data: any): any {
  if (data && typeof data.detail === 'string') {
    // 精确匹配
    if (errorMessageMap[data.detail]) {
      return { ...data, detail: errorMessageMap[data.detail] }
    }
    // 前缀匹配（处理带变量的错误，如 "Invalid file type: xxx"）
    for (const [en, zh] of Object.entries(errorMessageMap)) {
      if (data.detail.startsWith(en)) {
        return { ...data, detail: zh }
      }
    }
  }
  return data
}

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // 登录接口的 401 是认证失败，需要由调用方处理错误提示
      const isLoginRequest = error.config?.url?.endsWith('/auth/login')
      if (!isLoginRequest) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(translateError(error.response?.data) || error.message)
  }
)

export default request
