import { LoginForm } from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-center text-lg font-bold text-zinc-900">
          管理画面ログイン
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
