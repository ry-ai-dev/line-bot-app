import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/app/admin/_components/AdminHeader";

type ConversationRow = {
  id: string;
  line_user_id: string;
  direction: "user" | "bot";
  message_text: string;
  confidence: "high" | "mid" | "low" | null;
  escalated: boolean;
  created_at: string;
};

function maskUserId(id: string) {
  return `${id.slice(0, 8)}…`;
}

function confidenceBadge(confidence: ConversationRow["confidence"]) {
  switch (confidence) {
    case "high":
      return { text: "確信度:高", className: "bg-emerald-100 text-emerald-700" };
    case "mid":
      return { text: "確信度:中", className: "bg-amber-100 text-amber-700" };
    case "low":
      return { text: "確信度:低", className: "bg-red-100 text-red-700" };
    default:
      return null;
  }
}

export default async function ConversationsAdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, line_user_id, direction, message_text, confidence, escalated, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const conversations = (data ?? []) as ConversationRow[];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-10">
      <AdminHeader title="会話ログ" backHref="/admin" />
      <div className="flex flex-col gap-3 px-4">
        <p className="text-sm text-zinc-500">最新100件を新しい順に表示しています。</p>
        {error && (
          <p className="text-sm font-medium text-red-600">
            会話ログの取得に失敗しました。
          </p>
        )}
        {!error && conversations.length === 0 && (
          <p className="text-sm text-zinc-500">まだ会話記録がありません。</p>
        )}
        {conversations.map((row) => {
          const badge = confidenceBadge(row.confidence);
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-500">
                  {maskUserId(row.line_user_id)}（
                  {row.direction === "user" ? "お客様" : "bot"}）
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(row.created_at).toLocaleString("ja-JP")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-800">
                {row.message_text}
              </p>
              <div className="flex flex-wrap gap-2">
                {badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                )}
                {row.escalated && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    要確認
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
