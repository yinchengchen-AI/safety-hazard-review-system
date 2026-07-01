import request from './request'

export const getOverviewStats = () => request.get('/statistics/overview')
export const getEnterpriseStats = () => request.get('/statistics/enterprise')
export const getReportingUnitStats = () => request.get('/statistics/reporting-unit')
export const getBatchStats = () => request.get('/statistics/batch')
export const getInspectorStats = () => request.get('/statistics/inspector')
export const getTrendStats = (params: any) => request.get('/statistics/trend', { params })
