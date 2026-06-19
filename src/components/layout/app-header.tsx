import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';

export async function AppHeader() {
  const session = await auth();
  if (!session) return null;

  const navItems = [
    { href: '/', label: '工作台' },
    { href: '/cases', label: '案件' },
    { href: '/stats', label: '统计' },
    { href: '/me/notifications', label: '通知' },
  ];

  if (session.user.role === 'ADMIN') {
    navItems.push({ href: '/admin/users', label: '管理' });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-gov-blue text-white">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-8 text-base font-semibold tracking-wide">
          安全生产隐患复核系统
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-white/80"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="hidden md:inline">
            {session.user.name} ({session.user.role})
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="text-white/90 hover:text-white">
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
