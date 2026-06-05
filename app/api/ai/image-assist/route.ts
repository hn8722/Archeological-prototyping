import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { FieldDef } from "@/lib/templates/fieldSchema";
import { getUser } from "@/lib/auth/actions";
import { canUseSessionAi } from "@/lib/server/session-store";

type RequestBody = {
  sessionId?: string;
  imageBase64: string;   // "data:image/jpeg;base64,..."
  label: string;
  description?: string;
  fieldDefs: FieldDef[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.imageBase64 || !body.label || !body.fieldDefs?.length) {
      return NextResponse.json({ error: "必要なパラメータが不足しています。" }, { status: 400 });
    }

    const user = await getUser();
    if (!user || !body.sessionId) {
      return NextResponse.json({ error: "ログインとセッション情報が必要です。" }, { status: 401 });
    }
    const aiAccess = await canUseSessionAi(body.sessionId, user.id, user.email);
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: "このセッションではAI利用が停止されています。" }, { status: 403 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const fieldSchema = body.fieldDefs
      .map((def) => `"${def.key}": "${def.label}に入る内容（具体的に）"`)
      .join(",\n  ");

    const textPrompt = [
      `あなたはAPモデル（Archeological Prototyping）の専門家です。`,
      `以下の画像を見て、APモデルの「${body.label}」というモデル要素のフィールドを埋めてください。`,
      body.description ? `モデルの説明: ${body.description}` : "",
      ``,
      `画像から読み取れる内容をもとに、以下のJSONフォーマットのみを返してください（前置きや説明は不要）：`,
      `{`,
      `  ${fieldSchema}`,
      `}`,
    ].filter(Boolean).join("\n");

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: textPrompt,
            },
            {
              type: "input_image",
              image_url: body.imageBase64,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "画像解析結果を取得できませんでした。" }, { status: 502 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIの返答形式が不正でした。" }, { status: 502 });
    }

    const suggestion = JSON.parse(jsonMatch[0]) as Record<string, string>;
    return NextResponse.json({ suggestion, model });
  } catch (error) {
    console.error("Failed to analyze image", error);
    return NextResponse.json(
      { error: "画像解析に失敗しました。" },
      { status: 500 }
    );
  }
}
