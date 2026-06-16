import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">安全生产隐患复核系统</h1>
        <LoginForm />
      </div>
    </main>
  );
}
