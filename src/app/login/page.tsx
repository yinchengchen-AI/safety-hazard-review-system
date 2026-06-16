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
