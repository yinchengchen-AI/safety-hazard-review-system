import type { AxiosError } from 'axios'

export const errorMessageMap: Record<string, string> = {
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
  'Only pending tasks can be cancelled': '仅待复核的任务可取消',
  'Cannot delete photo from a completed or cancelled task': '已完成或已取消的任务不能删除照片',
  'No hazards selected': '未选择隐患',
  'Some hazards not found': '部分隐患不存在',
  'Hazard not in this task': '隐患不在此任务中',
  'File size exceeds 10MB limit': '文件大小超过10MB限制',
  'Invalid file type': '无效的文件类型',
  'File header does not match allowed image formats': '文件头与允许的图像格式不匹配',
  'Invalid image file': '无效的图片文件',
  'Image dimensions out of allowed range': '图片尺寸超出允许范围',
  '存在未复核的隐患，无法完成任务': '存在未复核的隐患，无法完成任务',
  '该隐患已被分配到复核任务中，任务完成或取消前不可编辑': '该隐患已被分配到复核任务中，任务完成或取消前不可编辑',
  'At least one active admin must remain': '系统中至少需要保留一名启用的管理员',
  'You cannot deactivate your own account': '不能停用您自己的账号',
  'You cannot remove your own admin role': '不能移除您自己的管理员角色',
  'Only the task creator or an admin can cancel this task': '仅任务创建者或管理员可取消该任务',
  'Task is no longer pending': '任务已不在待复核状态',
  '批次不存在': '批次不存在',
  '文件不存在': '文件不存在',
  '该批次中存在正在复核中的隐患，无法删除': '该批次中存在正在复核中的隐患，无法删除',
  '导入行数超过限制（最多 5000 行）': '导入行数超过限制（最多 5000 行）',
  'Excel 文件没有工作表': 'Excel 文件没有工作表',
  '重复数据（最近1个月内已存在）': '重复数据（最近1个月内已存在）',
  'UnauthorizedException': '未授权，请重新登录',
}

/**
 * Translate the FastAPI-style error payload from the backend into
 * a Chinese user-facing message. Falls back to the original
 * ``detail`` if no exact or prefix match is found, so we never
 * lose information for unknown errors.
 */
export function translateDetail(detail: unknown): string {
  if (typeof detail !== 'string' || !detail) {
    if (Array.isArray(detail)) return detail.map(String).join('; ')
    return ''
  }
  if (errorMessageMap[detail]) return errorMessageMap[detail]
  for (const [en, zh] of Object.entries(errorMessageMap)) {
    if (detail.startsWith(en)) return zh
  }
  return detail
}
