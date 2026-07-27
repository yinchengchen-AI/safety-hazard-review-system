import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './globals.css'

dayjs.locale('zh-cn')

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
