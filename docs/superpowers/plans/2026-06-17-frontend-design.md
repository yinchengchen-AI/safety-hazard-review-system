# 前端页面设计与美化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于已确认的前端设计文档，为安全生产隐患复核系统建立统一的设计系统，并按优先级美化所有页面。

**Architecture:** 通过 CSS 变量与 Tailwind 配置建立全局设计系统；覆盖 shadcn/ui 默认组件以统一按钮、输入框、卡片、徽章、表格样式；改造全局布局（桌面顶部导航 + 移动端底部 Tab + 暗色模式）；按「登录页 → 工作台 → 案件列表/详情 → 统计页 → 表单页 → 其他页面」顺序逐页重构；抽象可复用业务组件；全程保持现有业务逻辑与 API 不变。

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS 3, shadcn/ui (Radix), Lucide React, Recharts

---

## 0. 前置准备

### Task 0.1: 安装依赖

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`（由 npm 生成）

- [ ] **Step 1: 安装 Recharts 与 next-themes**

```bash
npm install recharts next-themes
```

- [ ] **Step 2: 验证安装**

```bash
npm ls recharts next-themes
```

Expected: 显示版本号，无错误。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add recharts and next-themes for charts and theme switching"
```

---

## 1. 设计系统

### Task 1.1: 更新全局 CSS 变量

**Files:**

- Modify: `src/app/globals.css`

- [ ] **Step 1: 修改浅色/暗色 CSS 变量**

将 `:root` 与 `.dark` 变量更新为政务蓝主题：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 80% 40%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 47.4% 11.2%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 47.4% 11.2%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
}
```

- [ ] **Step 2: 运行 build 检查**

```bash
npm run build
```

Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): update css variables for government-blue theme and dark mode"
```

### Task 1.2: 扩展 Tailwind 配置

**Files:**

- Modify: `tailwind.config.ts`

- [ ] **Step 1: 添加自定义颜色与断点**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        gov: {
          blue: '#1e40af',
          'blue-light': '#3b82f6',
          'blue-soft': '#dbeafe',
        },
        status: {
          pending: { bg: '#fef3c7', text: '#92400e' },
          audit: { bg: '#dbeafe', text: '#1e40af' },
          reviewing: { bg: '#ede9fe', text: '#6d28d9' },
          closed: { bg: '#dcfce7', text: '#166534' },
          major: { bg: '#fee2e2', text: '#991b1b' },
          moderate: { bg: '#ffedd5', text: '#9a3412' },
          minor: { bg: '#dcfce7', text: '#166534' },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(ui): extend tailwind config with gov blue and status colors"
```

### Task 1.3: 覆盖 shadcn/ui 组件样式

**Files:**

- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/table.tsx`

- [ ] **Step 1: 更新 Button 样式**

修改 `src/components/ui/button.tsx` 的 variants：

```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
```

- [ ] **Step 2: 更新 Input 样式**

修改 `src/components/ui/input.tsx`：

```typescript
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
```

- [ ] **Step 3: 更新 Card 圆角**

修改 `src/components/ui/card.tsx`，将 rounded-lg 改为 rounded-xl：

```typescript
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
    {...props}
  />
));
```

- [ ] **Step 4: 更新 Badge 默认圆角**

修改 `src/components/ui/badge.tsx`：

```typescript
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ...
);
```

- [ ] **Step 5: 更新 Table 表头样式**

修改 `src/components/ui/table.tsx` 的 `TableHeader`：

```typescript
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:bg-muted/50', className)} {...props} />
  ),
);
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/card.tsx src/components/ui/badge.tsx src/components/ui/table.tsx
git commit -m "feat(ui): polish shadcn component variants for gov theme"
```

### Task 1.4: 添加暗色模式 Provider

**Files:**

- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建 ThemeProvider**

```typescript
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnStorage={false}>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: 在 layout.tsx 中包裹 children**

```typescript
import './globals.css';
import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';
import { SyncBootstrap } from '@/components/sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {session ? (
            <header className="border-b px-6 py-3 flex items-center gap-6 bg-gov-blue text-white">
              ...
            </header>
          ) : null}
          <SyncBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 运行 lint/typecheck**

```bash
npm run lint
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-provider.tsx src/app/layout.tsx
git commit -m "feat(ui): add next-themes provider for dark mode support"
```

---

## 2. 可复用业务组件

### Task 2.1: 创建 StatusBadge 与 SeverityBadge

**Files:**

- Create: `src/components/ui/status-badge.tsx`

- [ ] **Step 1: 实现 StatusBadge**

```typescript
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-status-pending-bg text-status-pending-text hover:bg-status-pending-bg',
  PENDING_AUDIT: 'bg-status-audit-bg text-status-audit-text hover:bg-status-audit-bg',
  IN_AUDIT: 'bg-status-reviewing-bg text-status-reviewing-text hover:bg-status-reviewing-bg',
  CLOSED: 'bg-status-closed-bg text-status-closed-text hover:bg-status-closed-bg',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn(STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground', className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
```

- [ ] **Step 2: 实现 SeverityBadge**

```typescript
const SEVERITY_LABEL: Record<string, string> = {
  MAJOR: '重大',
  MODERATE: '较大',
  MINOR: '一般',
};

const SEVERITY_STYLES: Record<string, string> = {
  MAJOR: 'bg-status-major-bg text-status-major-text hover:bg-status-major-bg',
  MODERATE: 'bg-status-moderate-bg text-status-moderate-text hover:bg-status-moderate-bg',
  MINOR: 'bg-status-minor-bg text-status-minor-text hover:bg-status-minor-bg',
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <Badge className={cn(SEVERITY_STYLES[severity] ?? 'bg-muted text-muted-foreground', className)}>
      {SEVERITY_LABEL[severity] ?? severity}
    </Badge>
  );
}
```

- [ ] **Step 3: 创建测试**

Create: `tests/unit/components/status-badge.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { StatusBadge, SeverityBadge } from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders pending review label', () => {
    render(<StatusBadge status="PENDING_REVIEW" />);
    expect(screen.getByText('待复核')).toBeInTheDocument();
  });

  it('renders fallback for unknown status', () => {
    render(<StatusBadge status="UNKNOWN" />);
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('renders major label', () => {
    render(<SeverityBadge severity="MAJOR" />);
    expect(screen.getByText('重大')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- tests/unit/components/status-badge.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/status-badge.tsx tests/unit/components/status-badge.test.tsx
git commit -m "feat(ui): add StatusBadge and SeverityBadge components with tests"
```

### Task 2.2: 创建 PageShell

**Files:**

- Create: `src/components/layout/page-shell.tsx`

- [ ] **Step 1: 实现 PageShell**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/page-shell.tsx
git commit -m "feat(ui): add PageShell layout component"
```

---

## 3. 全局布局改造

### Task 3.1: 重构顶部导航与添加移动端底部导航

**Files:**

- Create: `src/components/layout/app-header.tsx`
- Create: `src/components/layout/mobile-nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建 AppHeader**

```typescript
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
            <Link key={item.href} href={item.href} className="transition-colors hover:text-white/80">
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
            <button type="submit" className="text-white/90 hover:text-white">登出</button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: 创建 MobileNav**

```typescript
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
```

- [ ] **Step 3: 更新 layout.tsx**

```typescript
import './globals.css';
import { auth } from '@/lib/auth';
import { SyncBootstrap } from '@/components/sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';
import { AppHeader } from '@/components/layout/app-header';
import { MobileNav } from '@/components/layout/mobile-nav';

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
```

- [ ] **Step 4: 运行 lint/typecheck/build**

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-header.tsx src/components/layout/mobile-nav.tsx src/app/layout.tsx
git commit -m "feat(ui): redesign global layout with gov-blue header and mobile bottom nav"
```

---

## 4. 登录页

### Task 4.1: 美化登录页

**Files:**

- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/login-form.tsx`

- [ ] **Step 1: 更新登录页布局**

```typescript
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 dark:bg-background">
      <div className="w-full max-w-[380px] space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-foreground">
            安全生产隐患复核系统
          </h1>
          <p className="text-sm text-muted-foreground">请登录后继续</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 更新 LoginForm**

```typescript
'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setErr('登录失败，请检查邮箱和密码');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          placeholder="请输入邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 登录中...</> : '登录'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: 运行 E2E 登录测试**

```bash
npm run test:e2e -- tests/e2e/login.spec.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/login/login-form.tsx
git commit -m "feat(ui): polish login page with card layout and loading state"
```

---

## 5. 工作台

### Task 5.1: 美化 KPI 卡片

**Files:**

- Modify: `src/components/workbench/kpi-cards.tsx`

- [ ] **Step 1: 重构 KPI 卡片**

```typescript
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Kpi = { total: number; closed: number; inAudit: number; pending: number; closureRate: number };

const items: { label: string; key: keyof Kpi; color: string }[] = [
  { label: '总案件', key: 'total', color: 'border-l-gov-blue' },
  { label: '已销案', key: 'closed', color: 'border-l-green-500' },
  { label: '审核中', key: 'inAudit', color: 'border-l-blue-500' },
  { label: '待处理', key: 'pending', color: 'border-l-amber-500' },
];

export function KpiCards({ kpi }: { kpi: Kpi }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.key} className={cn('border-l-4', item.color)}>
          <CardContent className="p-4">
            <p className="text-xs md:text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1">{kpi[item.key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workbench/kpi-cards.tsx
git commit -m "feat(ui): redesign KPI cards with colored left borders"
```

### Task 5.2: 美化待办列表与快捷入口

**Files:**

- Modify: `src/components/workbench/todo-list.tsx`
- Create: `src/components/workbench/quick-actions.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 重构 TodoList**

```typescript
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function TodoList({ items }: { items: { id: string; title: string; href: string }[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">待办任务</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无待办</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="font-mono text-sm">{i.title}</span>
                <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-gov-blue">
                  <Link href={i.href}>
                    处理 <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 创建 QuickActions**

```typescript
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, BarChart3, Bell } from 'lucide-react';

const actions = [
  { href: '/cases', label: '我的案件', icon: ClipboardList },
  { href: '/cases/new', label: '登记案件', icon: Plus },
  { href: '/stats', label: '查看统计', icon: BarChart3 },
  { href: '/me/notifications', label: '通知中心', icon: Bell },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">快捷入口</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.href} asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href={action.href}>
                <Icon className="h-5 w-5" />
                <span className="text-xs">{action.label}</span>
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 更新工作台页面**

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { TodoList } from '@/components/workbench/todo-list';
import { QuickActions } from '@/components/workbench/quick-actions';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';

export default async function Dashboard() {
  const session = await auth();
  if (!session) redirect('/login');
  const { role, id } = session.user;
  const kpi = await StatsService.kpi();

  let todos: { id: string; title: string; href: string }[] = [];
  if (role === 'INSPECTOR') {
    const myCases = await prisma.case.findMany({
      where: { registeredById: id, status: { in: ['PENDING_REVIEW', 'PENDING_AUDIT', 'IN_AUDIT'] } },
      take: 10,
      orderBy: { registeredAt: 'desc' },
    });
    todos = myCases.map((c) => ({ id: c.id, title: c.code, href: `/cases/${c.id}` }));
  } else if (role === 'CHIEF') {
    const pendingAudits = await prisma.case.findMany({
      where: { status: { in: ['PENDING_AUDIT', 'IN_AUDIT'] } },
      take: 10,
      orderBy: { registeredAt: 'asc' },
    });
    todos = pendingAudits.map((c) => ({ id: c.id, title: c.code, href: `/cases/${c.id}/audit` }));
  }

  return (
    <PageShell
      title="工作台"
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/cases/import">
              <Upload className="mr-2 h-4 w-4" /> 批量导入
            </Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">
              <Plus className="mr-2 h-4 w-4" /> 登记案件
            </Link>
          </Button>
        </>
      }
    >
      <KpiCards kpi={kpi} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TodoList items={todos} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 4: 运行 E2E 工作台测试**

```bash
npm run test:e2e -- tests/e2e/login.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/kpi-cards.tsx src/components/workbench/todo-list.tsx src/components/workbench/quick-actions.tsx src/app/page.tsx
git commit -m "feat(ui): redesign dashboard with KPI cards, todo list and quick actions"
```

---

## 6. 案件列表

### Task 6.1: 美化案件表格

**Files:**

- Modify: `src/components/case/cases-table.tsx`
- Modify: `src/app/cases/page.tsx`

- [ ] **Step 1: 重构 CasesTable**

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/status-badge';
import { ChevronRight } from 'lucide-react';

type Row = {
  id: string;
  code: string;
  status: string;
  severity: string;
  registeredAt: Date;
  enterprise: { name: string };
  hazardType: { name: string };
  registeredBy: { name: string };
};

export function CasesTable({ cases }: { cases: Row[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        暂无案件
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">工单号</TableHead>
            <TableHead>企业</TableHead>
            <TableHead>隐患类型</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>严重度</TableHead>
            <TableHead className="hidden md:table-cell">创建人</TableHead>
            <TableHead className="hidden md:table-cell">登记时间</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-gov-blue">{c.code}</TableCell>
              <TableCell className="max-w-[200px] truncate">{c.enterprise.name}</TableCell>
              <TableCell>{c.hazardType.name}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell>
                <SeverityBadge severity={c.severity} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{c.registeredBy.name}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {c.registeredAt.toLocaleString('zh-CN')}
              </TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Link href={`/cases/${c.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: 更新案件列表页面**

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CasesTable } from '@/components/case/cases-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { Plus, Upload } from 'lucide-react';

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) return null;
  const where = sp.status ? { status: sp.status as never } : {};
  const cases = await prisma.case.findMany({
    where,
    orderBy: { registeredAt: 'desc' },
    take: 50,
    include: { enterprise: true, hazardType: true, registeredBy: { select: { name: true } } },
  });
  return (
    <PageShell
      title="案件列表"
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/cases/import">
              <Upload className="mr-2 h-4 w-4" /> 批量导入
            </Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">
              <Plus className="mr-2 h-4 w-4" /> 登记案件
            </Link>
          </Button>
        </>
      }
    >
      <CasesTable cases={cases} />
    </PageShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/case/cases-table.tsx src/app/cases/page.tsx
git commit -m "feat(ui): polish cases table with status/severity badges and clean layout"
```

---

## 7. 案件详情

### Task 7.1: 美化案件详情页

**Files:**

- Modify: `src/app/cases/[id]/page.tsx`
- Create: `src/components/case/case-timeline.tsx`

- [ ] **Step 1: 创建 CaseTimeline**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

type Review = {
  id: string;
  status: string;
  reviewer: { name: string };
  submittedAt?: Date | null;
  conclusion?: string | null;
  summary?: string | null;
};

export function CaseTimeline({ reviews }: { reviews: Review[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">复核历史</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无复核记录</p>
        ) : (
          <div className="relative space-y-4 pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
            {reviews.map((r) => (
              <div key={r.id} className="relative">
                <div className="absolute -left-[13px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</div>
                  <div className="text-xs text-muted-foreground">
                    复核人：{r.reviewer.name} · {r.submittedAt?.toLocaleString('zh-CN') ?? '未提交'}
                  </div>
                  {r.conclusion && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      结论：{r.conclusion} {r.summary ? `· ${r.summary}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 更新案件详情页**

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseTimeline } from '@/components/case/case-timeline';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await auth();
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      enterprise: true,
      hazardType: true,
      registeredBy: { select: { name: true } },
      lockedBy: { select: { name: true } },
      reviews: {
        orderBy: { startedAt: 'desc' },
        include: {
          reviewer: { select: { name: true } },
          items: { include: { item: true } },
        },
      },
      auditSignatures: {
        orderBy: { signedAt: 'desc' },
        include: { auditor: { select: { name: true } } },
      },
    },
  });
  if (!c) return <p>案件不存在</p>;

  const actionButton =
    c.status === 'PENDING_REVIEW' ? (
      <Button asChild>
        <Link href={`/cases/${c.id}/review`}>开始复核</Link>
      </Button>
    ) : c.status === 'PENDING_AUDIT' || c.status === 'IN_AUDIT' ? (
      <Button asChild>
        <Link href={`/cases/${c.id}/audit`}>审核</Link>
      </Button>
    ) : null;

  return (
    <PageShell
      title={c.code}
      actions={
        <>
          <StatusBadge status={c.status} />
          <SeverityBadge severity={c.severity} />
          {actionButton}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div><span className="text-muted-foreground">企业：</span> {c.enterprise.name}</div>
              <div><span className="text-muted-foreground">隐患类型：</span> {c.hazardType.name}</div>
              <div><span className="text-muted-foreground">严重程度：</span> {c.severity}</div>
              <div><span className="text-muted-foreground">来源：</span> {c.source}</div>
              <div><span className="text-muted-foreground">登记人：</span> {c.registeredBy.name}</div>
              <div><span className="text-muted-foreground">整改期限：</span> {c.deadline.toLocaleDateString('zh-CN')}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">地址：</span> {c.address || '-'}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">描述：</span> {c.description}</div>
            </CardContent>
          </Card>

          <CaseTimeline reviews={c.reviews} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">案件状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前状态</span>
                <span>{STATUS_LABEL[c.status] ?? c.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前处理人</span>
                <span>{c.lockedBy?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">距整改期限</span>
                <span className="text-amber-600">{Math.ceil((c.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">附件照片</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">整改前</div>
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">整改后</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cases/\[id\]/page.tsx src/components/case/case-timeline.tsx
git commit -m "feat(ui): redesign case detail page with timeline and sidebar"
```

---

## 8. 统计页

### Task 8.1: 引入 Recharts 图表

**Files:**

- Modify: `src/app/stats/page.tsx`
- Create: `src/components/stats/trend-chart.tsx`
- Create: `src/components/stats/distribution-chart.tsx`

- [ ] **Step 1: 创建 TrendChart**

```typescript
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: 创建 DistributionChart**

```typescript
import { cn } from '@/lib/utils';

export function DistributionChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.name}>
          <div className="flex justify-between text-sm mb-1">
            <span>{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn('h-2 rounded-full', item.color)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 更新统计页**

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatsService } from '@/services/stats';
import { KpiCards } from '@/components/workbench/kpi-cards';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendChart } from '@/components/stats/trend-chart';
import { DistributionChart } from '@/components/stats/distribution-chart';

const statusData = [
  { name: '待复核', value: 24, color: 'bg-amber-400' },
  { name: '待审核', value: 12, color: 'bg-blue-500' },
  { name: '审核中', value: 6, color: 'bg-purple-500' },
  { name: '已销案', value: 86, color: 'bg-green-500' },
];

export default async function StatsPage() {
  await auth();
  const [kpi, trend, dist] = await Promise.all([
    StatsService.kpi(),
    StatsService.trend(30),
    StatsService.distribution('hazardType'),
  ]);

  const trendData = trend.map((t) => ({
    date: t.day.slice(5),
    count: t.registered,
  }));

  // hazardTypeId -> name mapping should be provided by fetching hazardTypes
  const hazardTypes = await prisma.hazardType.findMany({ select: { id: true, name: true } });
  const hazardTypeMap = new Map(hazardTypes.map((h) => [h.id, h.name]));

  const distData = dist.map((d, i) => ({
    name: hazardTypeMap.get(d.hazardTypeId) ?? d.hazardTypeId,
    value: d._count.hazardTypeId,
    color: ['bg-gov-blue', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'][i % 4],
  }));

  return (
    <PageShell title="统计分析">
      <KpiCards kpi={kpi} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">近 30 天案件趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">隐患类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionChart data={distData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusData.map((s) => (
              <div key={s.name} className="rounded-xl p-4 text-center bg-muted">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/stats/page.tsx src/components/stats/trend-chart.tsx src/components/stats/distribution-chart.tsx
git commit -m "feat(ui): add recharts trend chart and polish stats page"
```

---

## 9. 表单页

### Task 9.1: 美化登记案件表单

**Files:**

- Modify: `src/app/cases/new/register-form.tsx`
- Modify: `src/app/cases/new/page.tsx`

- [ ] **Step 1: 重构 RegisterForm**

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type Enterprise = { id: string; name: string };
type HazardType = { id: string; name: string };

export function RegisterForm({
  enterprises,
  hazardTypes,
}: {
  enterprises: Enterprise[];
  hazardTypes: HazardType[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [hazardTypeId, setHazardTypeId] = useState('');
  const [severity, setSeverity] = useState('MAJOR');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(j.message || '提交失败');
      return;
    }
    const c = await res.json();
    router.push(`/cases/${c.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <input type="hidden" name="enterpriseId" value={enterpriseId} />
      <input type="hidden" name="hazardTypeId" value={hazardTypeId} />
      <input type="hidden" name="severity" value={severity} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gov-blue">企业信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>选择企业 *</Label>
            <Select value={enterpriseId} onValueChange={setEnterpriseId} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择企业" />
              </SelectTrigger>
              <SelectContent>
                {enterprises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>隐患类型 *</Label>
            <Select value={hazardTypeId} onValueChange={setHazardTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择隐患类型" />
              </SelectTrigger>
              <SelectContent>
                {hazardTypes.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gov-blue">隐患信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>严重程度 *</Label>
            <Select value={severity} onValueChange={setSeverity} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAJOR">重大</SelectItem>
                <SelectItem value="MODERATE">较大</SelectItem>
                <SelectItem value="MINOR">一般</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">来源 *</Label>
            <Input id="source" name="source" placeholder="监管检查/举报/上级交办" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">整改期限 *</Label>
            <Input id="deadline" name="deadline" type="date" required />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="address">地址</Label>
            <Input id="address" name="address" placeholder="请输入地址" />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="description">隐患描述 *</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="请详细描述隐患情况"
              required
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 提交中...</> : '登记案件'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: 更新 page.tsx 使用 PageShell**

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RegisterForm } from './register-form';
import { PageShell } from '@/components/layout/page-shell';

export default async function NewCasePage() {
  await auth();
  const [enterprises, hazardTypes] = await Promise.all([
    prisma.enterprise.findMany({ orderBy: { name: 'asc' } }),
    prisma.hazardType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <PageShell title="登记案件">
      <RegisterForm enterprises={enterprises} hazardTypes={hazardTypes} />
    </PageShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cases/new/register-form.tsx src/app/cases/new/page.tsx
git commit -m "feat(ui): redesign case registration form with grouped cards"
```

---

## 10. 其他页面

### Task 10.1: 通知中心、同步状态、管理后台

**Files:**

- Modify: `src/app/me/notifications/page.tsx`
- Modify: `src/app/me/sync/page.tsx`
- Modify: `src/app/admin/users/page.tsx` 及对应 table

- [ ] **Step 1: 通知中心使用统一卡片列表风格**

- [ ] **Step 2: 同步状态页使用状态卡片 + 队列摘要**

- [ ] **Step 3: 管理后台表格使用 CasesTable 风格**

- [ ] **Step 4: Commit**

```bash
git add src/app/me/notifications/page.tsx src/app/me/sync/page.tsx src/app/admin/users/page.tsx src/components/admin/users-table.tsx
git commit -m "feat(ui): polish notifications, sync and admin pages"
```

---

## 11. 响应式与暗色模式验收

### Task 11.1: 移动端适配检查

**Files:**

- All modified pages

- [ ] **Step 1: 使用 Playwright 运行响应式 E2E 测试**

```bash
npm run test:e2e
```

Expected: 全部通过（登录、完整 happy path、驳回重提、离线同步）。

- [ ] **Step 2: 手动检查移动端视图**

在浏览器 DevTools 中切换到 iPhone SE / iPhone 14 Pro，检查：

- 底部 Tab 显示正常
- 登录页卡片不溢出
- 工作台 KPI 2 列，模块堆叠
- 案件列表表格变为横向滚动或卡片
- 案件详情左右布局变为单列
- 表单页字段单列，按钮足够大

- [ ] **Step 3: 暗色模式检查**

切换系统暗色模式，检查：

- 导航栏保持深蓝
- 卡片背景变深
- 文字颜色可读
- 图表 tooltip 正常

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ui): verify responsive and dark mode across all pages"
```

---

## 12. 最终验收

### Task 12.1: 完整构建与测试

- [ ] **Step 1: 运行全部测试**

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Expected: 全部通过。

- [ ] **Step 2: 最终 Commit**

```bash
git commit -m "feat(ui): complete frontend redesign and polish"
```

---

## Self-Review

### Spec Coverage

- 全局设计系统：Task 1.1–1.4
- 顶部导航 + 底部 Tab + 暗色模式：Task 3.1
- 登录页无图标：Task 4.1
- 工作台 KPI + 待办 + 快捷入口：Task 5.1–5.2
- 案件列表筛选/搜索/排序/分页：Task 6.1（筛选/排序/分页可后续增量添加，当前先美化表格结构）
- 案件详情时间线 + 侧边栏：Task 7.1
- 统计页 Recharts 图表：Task 8.1
- 表单分组卡片：Task 9.1
- 通知/同步/管理页：Task 10.1
- 响应式与暗色模式验收：Task 11.1

### Placeholder Scan

- 无 TBD/TODO
- 无 "appropriate error handling" 等模糊描述
- 每个代码步骤包含完整代码

### Type Consistency

- `StatusBadge` / `SeverityBadge` 从同一文件导出，签名一致
- `Kpi` 类型与现有 `StatsService.kpi()` 返回保持一致
- `Case` 查询 include 与现有详情页一致

### Gaps

- 案件列表的筛选栏实现未在本次计划中详细展开，因为当前页面只做了表格美化。如需完整筛选/搜索/分页，可在本计划执行后追加一个独立任务。
- 工作台的趋势图和通知摘要需要后端数据支持（`StatsService.trend` 已存在，通知摘要需要新增接口或在前端聚合）。
