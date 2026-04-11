import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";

type RelatedCard = {
  label: string;
  text: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: string;
      description?: string;
      hint?: string | null;
      currentText?: string;
      affected?: RelatedCard[];
      affecting?: RelatedCard[];
    };

    if (!body.label) {
      return NextResponse.json({ error: "対象ラベルが必要です。" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const prompt = [
      `あなたはArcheological Prototypingワークショップの支援者です。`,
      `対象モデル: ${body.label}`,
      `説明: ${body.description ?? "なし"}`,
      `ヒント: ${body.hint ?? "なし"}`,
      `現在の入力: ${body.currentText?.trim() || "まだ入力なし"}`,
      `影響を受ける関連項目: ${
        body.affected?.map((item) => `${item.label}: ${item.text || "未入力"}`).join(" / ") || "なし"
      }`,
      `影響を与える関連項目: ${
        body.affecting?.map((item) => `${item.label}: ${item.text || "未入力"}`).join(" / ") || "なし"
      }`,
      "日本語で、ワークショップ参加者がそのまま叩き台にできる30〜120文字程度の文章案を1つだけ返してください。",
      "前置きや箇条書きは不要で、本文だけを返してください。",
    ].join("\n");

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const suggestion = response.output_text?.trim();

    if (!suggestion) {
      return NextResponse.json({ error: "AIアシスト結果を取得できませんでした。" }, { status: 502 });
    }

    return NextResponse.json({ suggestion, model });
  } catch (error) {
    console.error("Failed to generate assist text", error);
    return NextResponse.json(
      { error: "AIアシストの生成に失敗しました。OPENAI_API_KEY の設定も確認してください。" },
      { status: 500 }
    );
  }
}
