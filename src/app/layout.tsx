import './globals.css';
import { auth } from '@/lib/auth';
import { SyncBootstrap } from '@/components/sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';
import { AppHeader } from '@/components/layout/app-header';
import { MobileNav } from '@/components/layout/mobile-nav';

export const metadata = { title: '安全生产隐患复核系统' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <ThemeProvider>
          <AppHeader />
          <div className={session ? 'pb-16 md:pb-0' : ''}>{children}</div>
          {session ? <MobileNav /> : null}
          <SyncBootstrap />
        </ThemeProvider>
      </body>
    </html>
  );
}
