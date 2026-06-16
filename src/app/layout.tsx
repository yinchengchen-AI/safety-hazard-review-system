import './globals.css';
import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';

export const metadata = { title: '安全生产隐患复核系统' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="zh-CN">
      <body>
        {session ? (
          <header className="border-b px-6 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold">安全生产隐患复核</Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/cases">案件</Link>
              <Link href="/stats">统计</Link>
              <Link href="/me/notifications">通知</Link>
              <Link href="/me/sync">同步</Link>
              {session.user.role === 'ADMIN' && <Link href="/admin/users">管理</Link>}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span>
                {session.user.name} ({session.user.role})
              </span>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <button className="text-blue-600">登出</button>
              </form>
            </div>
          </header>
        ) : null}
        {children}
      </body>
    </html>
  );
}
