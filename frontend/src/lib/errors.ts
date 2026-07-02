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

export function translateError(data: any): any {
  if (data && typeof data.detail === 'string') {
    if (errorMessageMap[data.detail]) {
      return { ...data, detail: errorMessageMap[data.detail] }
    }
    for (const [en, zh] of Object.entries(errorMessageMap)) {
      if (data.detail.startsWith(en)) {
        return { ...data, detail: zh }
      }
    }
  }
  return data
}
