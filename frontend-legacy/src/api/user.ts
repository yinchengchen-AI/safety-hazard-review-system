import request from './request'

export const getUsers = (params: any) => request.get('/users', { params })
export const createUser = (data: any) => request.post('/users', data)
export const updateUser = (id: string, data: any) => request.put(`/users/${id}`, data)
export const deleteUser = (id: string) => request.delete(`/users/${id}`)
export const resetPassword = (id: string, data: any) => request.post(`/users/${id}/reset-password`, data)
