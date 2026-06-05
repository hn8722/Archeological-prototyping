import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/server/openai";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { FieldDef } from "@/lib/templates/fieldSchema";
import { getUser } from "@/lib/auth/actions";
import { canUseSessionAi } from "@/lib/server/session-store";

type RequestBody = {
  sessionId?: string;
  label: string;
  description?: string | null;
  fieldDefs: FieldDef[];
  fields: Record<string, string>;
};

const GENERATED_IMAGE_BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET || "generated-images";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.label || !body.fieldDefs?.length || !body.fields) {
      return NextResponse.json({ error: "画像生成に必要な入力が不足しています。" }, { status: 400 });
    }

    const user = await getUser();
    if (!user || !body.sessionId) {
      return NextResponse.json({ error: "ログインとセッション情報が必要です。" }, { status: 401 });
    }
    const aiAccess = await canUseSessionAi(body.sessionId, user.id, user.email);
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: "このセッションではAI利用が停止されています。" }, { status: 403 });
    }

    const promptLines = body.fieldDefs
      .map((def) => {
        const value = body.fields[def.key]?.trim();
        return value ? `- ${def.label}: ${value}` : null;
      })
      .filter(Boolean);

    if (promptLines.length === 0) {
      return NextResponse.json({ error: "画像化するテキストを入力してください。" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const response = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      size: "1024x1024",
      prompt: [
        "Archeological PrototypingのUX確認用イメージを生成してください。",
        `対象モデル: ${body.label}`,
        body.description ? `モデル説明: ${body.description}` : "",
        "ユーザーが入力した意図を、説明的な図ではなく具体的な利用場面として表現してください。",
        "文字やUIラベルは入れず、入力内容が視覚的に反映されているか判断しやすい構図にしてください。",
        "",
        "入力内容:",
        ...promptLines,
      ].filter(Boolean).join("\n"),
    });

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: "画像生成結果を取得できませんでした。" }, { status: 502 });
    }

    const supabase = await createSupabaseServerClient();
    const storagePath = `intent-images/${crypto.randomUUID()}.png`;
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const { error: uploadError } = await supabase.storage
      .from(GENERATED_IMAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload generated image", uploadError);
      return NextResponse.json(
        {
          error:
            "生成画像の保存に失敗しました。Supabase Storageのバケット設定を確認してください。",
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(GENERATED_IMAGE_BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      imageUrl: publicUrlData.publicUrl,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      storagePath,
    });
  } catch (error) {
    console.error("Failed to generate image", error);
    return NextResponse.json(
      { error: getOpenAIErrorMessage(error, "画像生成に失敗しました。OPENAI_API_KEY、画像生成モデル、請求上限を確認してください。") },
      { status: 500 }
    );
  }
}

function getOpenAIErrorMessage(error: unknown, fallback: string) {
  const openAIError = error as { code?: string; status?: number; message?: string };

  if (openAIError.code === "billing_hard_limit_reached") {
    return "OpenAI APIの請求上限に達しています。Billingのhard limitまたは利用上限を引き上げてから再試行してください。";
  }

  if (openAIError.code === "insufficient_quota") {
    return "OpenAI APIの利用枠が不足しています。このAPIキーが属するプロジェクトのBilling、Usage limits、支払い設定を確認してください。";
  }

  if (openAIError.status === 401) {
    return "OPENAI_API_KEYが無効、または期限切れの可能性があります。";
  }

  if (openAIError.status === 404 || openAIError.code === "model_not_found") {
    return "画像生成モデルが利用できません。OPENAI_IMAGE_MODELの設定、またはアカウントのモデル利用権限を確認してください。";
  }

  return process.env.NODE_ENV === "development" && openAIError.message
    ? `${fallback} (${openAIError.message})`
    : fallback;
}
