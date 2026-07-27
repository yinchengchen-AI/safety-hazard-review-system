import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import type { Metadata } from 'next'
import './globals.css'

dayjs.locale('zh-cn')

export const metadata: Metadata = {
  title: '安全生产隐患复核系统',
  description: '企业安全隐患排查、复核任务分配与闭环管理',
}

const theme = {
  token: {
    colorPrimary: '#1677ff',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={zhCN} theme={theme}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
