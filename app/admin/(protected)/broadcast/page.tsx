"use client";

import { useState } from "react";
import { AdminHeader } from "@/app/admin/_components/AdminHeader";

const MAX_LENGTH = 500;

export default function BroadcastAdminPage() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const remaining = MAX_LENGTH - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0;

  async function send(mode: "test" | "all") {
    if (isSubmitting || isEmpty || isOverLimit) return;

    if (mode === "all") {
      const confirmed = window.confirm(
        "友だち全員に送信します。取り消しできません。よろしいですか？"
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setResultMessage({
          type: "error",
          text: data?.message ?? "送信に失敗しました。もう一度お試しください。",
        });
        return;
      }

      setResultMessage({
        type: "success",
        text:
          mode === "test"
            ? "自分宛にテスト送信しました。"
            : "友だち全員に送信しました。",
      });
    } catch {
      setResultMessage({ type: "error", text: "通信エラーが発生しました。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-10">
      <AdminHeader title="お知らせ配信" backHref="/admin" />
      <div className="flex flex-col gap-4 px-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          お知らせ本文
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder="友だち全員に届くメッセージを入力してください"
            className="min-h-[132px] rounded-lg border border-zinc-300 px-3 py-2 text-base"
          />
        </label>
        <p
          className={`text-right text-xs ${
            isOverLimit ? "font-semibold text-red-600" : "text-zinc-400"
          }`}
        >
          {text.length} / {MAX_LENGTH}文字
        </p>

        {resultMessage && (
          <p
            className={`text-sm font-medium ${
              resultMessage.type === "success"
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            {resultMessage.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => send("test")}
          disabled={isSubmitting || isEmpty || isOverLimit}
          className="h-12 min-h-[44px] rounded-lg border border-zinc-300 text-base font-medium text-zinc-700 disabled:opacity-50"
        >
          {isSubmitting ? "送信中..." : "テスト送信（自分だけ）"}
        </button>
        <button
          type="button"
          onClick={() => send("all")}
          disabled={isSubmitting || isEmpty || isOverLimit}
          className="h-12 min-h-[44px] rounded-lg bg-red-600 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "送信中..." : "全員に送信"}
        </button>
      </div>
    </div>
  );
}
