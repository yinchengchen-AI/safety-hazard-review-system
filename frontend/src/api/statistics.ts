import request from './request'

export const getEnterpriseStats = () => request.get('/statistics/enterprise')
export const getBatchStats = () => request.get('/statistics/batch')
export const getInspectorStats = () => request.get('/statistics/inspector')
export const getTrendStats = (params: any) => request.get('/statistics/trend', { params })
