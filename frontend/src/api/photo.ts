import request from './request'

export const uploadPhoto = async (formData: FormData) => {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch('/api/v1/photos/upload', {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '上传失败' }))
    throw err
  }
  return res.json()
}

export const deletePhoto = (photoId: string) => request.delete(`/photos/${photoId}`)

