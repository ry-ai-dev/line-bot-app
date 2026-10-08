"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage("メールアドレスまたはパスワードが正しくありません。");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrorMessage("ログインに失敗しました。しばらくしてからもう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        メールアドレス
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        パスワード
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
        />
      </label>
      {errorMessage && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-12 min-h-[44px] rounded-lg bg-zinc-900 text-base font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
