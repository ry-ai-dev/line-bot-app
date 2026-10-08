import { messagingApi } from "@line/bot-sdk";
import { createClient } from "@/lib/supabase/server";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const ownerLineUserId = process.env.OWNER_LINE_USER_ID ?? "";

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

const MAX_LENGTH = 500;

export async function POST(request: Request) {
  let body: { mode?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  const { mode, text } = body;

  if ((mode !== "test" && mode !== "all") || typeof text !== "string") {
    return Response.json(
      { message: "リクエストの内容が正しくありません。" },
      { status: 400 }
    );
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0 || trimmedText.length > MAX_LENGTH) {
    return Response.json(
      { message: `本文は1〜${MAX_LENGTH}文字で入力してください。` },
      { status: 400 }
    );
  }

  // 画面側のチェックだけに頼らず、サーバー側で必ずログイン＋管理者権限を検証する。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ message: "ログインが必要です。" }, { status: 401 });
  }

  const { data: isAdmin, error: adminCheckError } = await supabase.rpc(
    "is_bot_admin"
  );

  if (adminCheckError || !isAdmin) {
    return Response.json(
      { message: "この操作の権限がありません。" },
      { status: 403 }
    );
  }

  try {
    if (mode === "test") {
      if (!ownerLineUserId) {
        return Response.json(
          { message: "OWNER_LINE_USER_ID が設定されていません。" },
          { status: 500 }
        );
      }
      await lineClient.pushMessage({
        to: ownerLineUserId,
        messages: [{ type: "text", text: trimmedText }],
      });
    } else {
      await lineClient.broadcast({
        messages: [{ type: "text", text: trimmedText }],
      });
    }
  } catch (error) {
    console.error("お知らせ配信の送信に失敗しました:", error);
    return Response.json(
      { message: "LINEへの送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 502 }
    );
  }

  return Response.json({ message: "送信しました。" });
}
