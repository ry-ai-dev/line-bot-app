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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("faq")
    .select("category, question, answer")
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`FAQの取得でエラーが発生しました: ${error.message}`);
  }
  if (!data || data.length === 0) {
    console.log("FAQは0件です(未登録のため回答に使えるFAQがありません)");
  }
  return data ?? [];
}

async function fetchMenuList(): Promise<MenuEntry[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("menus")
    .select("name, price, description")
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`メニューの取得でエラーが発生しました: ${error.message}`);
  }
  if (!data || data.length === 0) {
    console.log("メニューは0件です(未登録のため回答に使えるメニューがありません)");
  }
  return data ?? [];
}

async function pushToOwner(text: string) {
  if (!ownerLineUserId) {
    return;
  }
  try {
    await lineClient.pushMessage({
      to: ownerLineUserId,
      messages: [{ type: "text", text }],
    });
  } catch (error) {
    console.error("オーナーへの通知に失敗しました:", error);
  }
}

async function notifyOwnerOfLowConfidence(params: {
  userMessage: string;
  botAnswer: string;
}) {
  await pushToOwner(
    `お客様から確信度の低い質問がありました。\n質問：${params.userMessage}\nbotの回答：${params.botAnswer}`
  );
}

async function notifyOwnerOfFaqFetchError(userMessage: string) {
  await pushToOwner(
    `FAQ取得エラー\nFAQ・メニューの取得に失敗したため、お客様には「担当者に確認します」と返信しました。\n質問：${userMessage}\n確認をお願いします。`
  );
}

type NonTextMessageType = Exclude<
  webhook.MessageContent["type"],
  "text" | "sticker"
>;

const NON_TEXT_MESSAGE_LABELS: Record<NonTextMessageType, string> = {
  image: "[画像]",
  video: "[動画]",
  audio: "[音声]",
  file: "[ファイル]",
  location: "[位置情報]",
};

const UNSUPPORTED_MESSAGE_REPLY =
  "メッセージありがとうございます。申し訳ございませんが、画像などの形式にはまだ対応しておりません。\nお手数ですが、テキストでご質問をお送りください。";

const FAQ_FETCH_ERROR_REPLY = "申し訳ございません、担当者に確認してお答えします";

async function handleMessageEvent(event: webhook.MessageEvent) {
  if (!event.replyToken) {
    return;
  }

  const userId = event.source?.type === "user" ? event.source.userId : undefined;

  if (event.message.type === "sticker") {
    return;
  }

  if (event.message.type !== "text") {
    if (userId) {
      await recordConversation({
        lineUserId: userId,
        direction: "user",
        messageText: NON_TEXT_MESSAGE_LABELS[event.message.type],
      });
    }

    try {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: UNSUPPORTED_MESSAGE_REPLY }],
      });
    } catch (error) {
      console.error("LINEへの返信に失敗しました:", error);
    }
    return;
  }

  const receivedText = event.message.text;

  if (userId) {
    await recordConversation({
      lineUserId: userId,
      direction: "user",
      messageText: receivedText,
    });
  }

  let faqList: FaqEntry[];
  let menuList: MenuEntry[];
  try {
    [faqList, menuList] = await Promise.all([
      fetchFaqList(),
      fetchMenuList(),
    ]);
  } catch (error) {
    console.error("FAQ・メニューの取得エラーのため回答をスキップしました:", error);

    try {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: FAQ_FETCH_ERROR_REPLY }],
      });
    } catch (replyError) {
      console.error("LINEへの返信に失敗しました:", replyError);
    }

    if (userId) {
      await recordConversation({
        lineUserId: userId,
        direction: "bot",
        messageText: FAQ_FETCH_ERROR_REPLY,
        confidence: "low",
        escalated: true,
      });
    }

    await notifyOwnerOfFaqFetchError(receivedText);
    return;
  }

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
      await handleMessageEvent(event);
    } catch (error) {
      console.error("Webhookイベントの処理に失敗しました:", error);
    }
  }

  return new Response("ok", { status: 200 });
}
