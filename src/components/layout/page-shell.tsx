import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageShell({ title, children, actions, className }: PageShellProps) {
  return (
    <main className={cn('container mx-auto p-4 md:p-6 space-y-4 md:space-y-6', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </main>
  );
}
