import { messagingApi, validateSignature, webhook } from "@line/bot-sdk";
import { createServiceClient } from "@/lib/supabase/service";

const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

async function recordConversation(params: {
  lineUserId: string;
  direction: "user" | "bot";
  messageText: string;
}) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("conversations").insert({
      line_user_id: params.lineUserId,
      direction: params.direction,
      message_text: params.messageText,
    });
    if (error) {
      console.error("conversations への記録に失敗しました:", error.message);
    }
  } catch (error) {
    console.error("Supabase への接続に失敗しました:", error);
  }
}

async function handleTextMessageEvent(event: webhook.MessageEvent) {
  if (event.message.type !== "text") {
    return;
  }
  if (!event.replyToken) {
    return;
  }

  const userId = event.source?.type === "user" ? event.source.userId : undefined;
  const receivedText = event.message.text;

  if (userId) {
    await recordConversation({
      lineUserId: userId,
      direction: "user",
      messageText: receivedText,
    });
  }

  try {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: receivedText }],
    });
  } catch (error) {
    console.error("LINEへの返信に失敗しました:", error);
    return;
  }

  if (userId) {
    await recordConversation({
      lineUserId: userId,
      direction: "bot",
      messageText: receivedText,
    });
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !validateSignature(body, channelSecret, signature)) {
    return new Response("invalid signature", { status: 400 });
  }

  let callbackRequest: webhook.CallbackRequest;
  try {
    callbackRequest = JSON.parse(body);
  } catch (error) {
    console.error("Webhookリクエストボディのパースに失敗しました:", error);
    return new Response("invalid request body", { status: 400 });
  }

  for (const event of callbackRequest.events ?? []) {
    if (event.type !== "message") {
      continue;
    }
    try {
      await handleTextMessageEvent(event);
    } catch (error) {
      console.error("Webhookイベントの処理に失敗しました:", error);
    }
  }

  return new Response("ok", { status: 200 });
}
