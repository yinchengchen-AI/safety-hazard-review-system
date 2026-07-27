import request from './api'

/**
 * 通过 axios 下载接口返回的二进制内容，并触发浏览器保存为本地文件。
 */
export async function downloadBlob(url: string, filename: string): Promise<void> {
  const data = (await request.get(url, { responseType: 'blob' })) as Blob
  const objectUrl = window.URL.createObjectURL(new Blob([data]))
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}
