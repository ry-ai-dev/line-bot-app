import { messagingApi, validateSignature, webhook } from "@line/bot-sdk";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateAnswer,
  type Confidence,
  type FaqEntry,
  type MenuEntry,
} from "@/lib/claude";

const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const ownerLineUserId = process.env.OWNER_LINE_USER_ID ?? "";

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

async function recordConversation(params: {
  lineUserId: string;
  direction: "user" | "bot";
  messageText: string;
  confidence?: Confidence;
  escalated?: boolean;
}) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("conversations").insert({
      line_user_id: params.lineUserId,
      direction: params.direction,
      message_text: params.messageText,
      confidence: params.confidence ?? null,
      escalated: params.escalated ?? false,
    });
    if (error) {
      console.error("conversations への記録に失敗しました:", error.message);
    }
  } catch (error) {
    console.error("Supabase への接続に失敗しました:", error);
  }
}

async function fetchFaqList(): Promise<FaqEntry[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("faq")
      .select("category, question, answer")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("FAQの取得に失敗しました:", error.message);
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.error("Supabase への接続に失敗しました:", error);
    return [];
  }
}

async function fetchMenuList(): Promise<MenuEntry[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("menus")
      .select("name, price, description")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("メニューの取得に失敗しました:", error.message);
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.error("Supabase への接続に失敗しました:", error);
    return [];
  }
}

async function notifyOwnerOfLowConfidence(params: {
  userMessage: string;
  botAnswer: string;
}) {
  if (!ownerLineUserId) {
    return;
  }
  try {
    await lineClient.pushMessage({
      to: ownerLineUserId,
      messages: [
        {
          type: "text",
          text: `お客様から確信度の低い質問がありました。\n質問：${params.userMessage}\nbotの回答：${params.botAnswer}`,
        },
      ],
    });
  } catch (error) {
    console.error("オーナーへのエスカレーション通知に失敗しました:", error);
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

  const [faqList, menuList] = await Promise.all([
    fetchFaqList(),
    fetchMenuList(),
  ]);
  const { answer, confidence } = await generateAnswer(
    receivedText,
    faqList,
    menuList
  );

  try {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: answer }],
    });
  } catch (error) {
    console.error("LINEへの返信に失敗しました:", error);
    return;
  }

  const escalated = confidence === "low";

  if (userId) {
    await recordConversation({
      lineUserId: userId,
      direction: "bot",
      messageText: answer,
      confidence,
      escalated,
    });
  }

  if (escalated) {
    await notifyOwnerOfLowConfidence({
      userMessage: receivedText,
      botAnswer: answer,
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
