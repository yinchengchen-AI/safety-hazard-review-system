import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '安全生产隐患复核系统',
  description: '应急管理局安全生产隐患复核系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
