import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type Confidence = "high" | "mid" | "low";

export interface FaqEntry {
  category: string | null;
  question: string;
  answer: string;
}

export interface MenuEntry {
  name: string;
  price: number;
  description: string | null;
}

export interface GenerateAnswerResult {
  answer: string;
  confidence: Confidence;
}

const FALLBACK_RESULT: GenerateAnswerResult = {
  answer: "申し訳ございません、担当者に確認してお答えします",
  confidence: "low",
};

function buildSystemPrompt(faqList: FaqEntry[], menuList: MenuEntry[]): string {
  const faqText = faqList
    .map(
      (faq, index) =>
        `${index + 1}. [カテゴリ: ${faq.category ?? "未分類"}] Q: ${faq.question}\n   A: ${faq.answer}`
    )
    .join("\n");

  const menuText = menuList
    .map(
      (menu, index) =>
        `${index + 1}. ${menu.name} / ${menu.price.toLocaleString("ja-JP")}円${
          menu.description ? ` / ${menu.description}` : ""
        }`
    )
    .join("\n");

  return `あなたは美容室の問い合わせ対応をするLINE公式アカウントのアシスタントです。
以下のFAQ一覧とメニュー・料金一覧だけを根拠情報として、ユーザーの質問に日本語で回答してください。

# FAQ一覧
${faqText}

# メニュー・料金一覧
${menuText}

# 回答ルール
- FAQまたはメニュー・料金一覧に直接該当する記述がある場合は confidence を "high" にする。
- FAQ・メニューから推測すれば答えられるが完全には一致しない場合は confidence を "mid" にする。
- FAQ・メニューに該当する記述が無い場合、質問が関係ない場合、または判断がつかない場合は confidence を "low" にする。
- 自己判断で新しい情報を作らないこと。わからない場合は「わかりません、担当者に確認します」のように正直に答え、confidenceを"low"にする。

# 出力形式
必ず次のJSON形式のみで出力してください。他のテキストは一切含めないこと。
{"answer": "回答文", "confidence": "high" | "mid" | "low"}`;
}

function isConfidence(value: unknown): value is Confidence {
  return value === "high" || value === "mid" || value === "low";
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return trimmed;
  }
  return trimmed.slice(firstBrace, lastBrace + 1);
}

export async function generateAnswer(
  userMessage: string,
  faqList: FaqEntry[],
  menuList: MenuEntry[] = []
): Promise<GenerateAnswerResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(faqList, menuList),
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return FALLBACK_RESULT;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonText(textBlock.text));
    } catch (error) {
      console.error("Claudeの応答のJSONパースに失敗しました:", error);
      return FALLBACK_RESULT;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("answer" in parsed) ||
      !("confidence" in parsed) ||
      typeof (parsed as Record<string, unknown>).answer !== "string" ||
      !isConfidence((parsed as Record<string, unknown>).confidence)
    ) {
      return FALLBACK_RESULT;
    }

    return {
      answer: (parsed as { answer: string }).answer,
      confidence: (parsed as { confidence: Confidence }).confidence,
    };
  } catch (error) {
    console.error("Claude APIの呼び出しに失敗しました:", error);
    return FALLBACK_RESULT;
  }
}
