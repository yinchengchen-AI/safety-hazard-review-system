'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, BarChart3, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: '首页', icon: Home },
  { href: '/cases', label: '案件', icon: ClipboardList },
  { href: '/stats', label: '统计', icon: BarChart3 },
  { href: '/me/notifications', label: '通知', icon: Bell },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden">
      <div className="flex h-16 items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 text-xs',
                active ? 'text-gov-blue font-medium' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
