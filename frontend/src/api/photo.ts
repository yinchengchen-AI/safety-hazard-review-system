import request from './request'

export const uploadPhoto = (formData: FormData) =>
  request.post('/photos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deletePhoto = (photoId: string) => request.delete(`/photos/${photoId}`)

