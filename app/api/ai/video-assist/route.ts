import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { FieldDef } from "@/lib/templates/fieldSchema";

type RequestBody = {
  videoUrl: string;
  label: string;
  description?: string;
  fieldDefs: FieldDef[];
};

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

async function fetchVideoMetadata(url: string): Promise<string> {
  // YouTube oEmbed（認証不要の公開API）
  const isYoutube =
    url.includes("youtube.com") || url.includes("youtu.be");

  if (isYoutube) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as OEmbedResponse;
        const lines: string[] = [`URL: ${url}`];
        if (data.title) lines.push(`タイトル: ${data.title}`);
        if (data.author_name) lines.push(`チャンネル: ${data.author_name}`);
        return lines.join("\n");
      }
    } catch {
      // フォールバックへ
    }
  }

  // Vimeo oEmbed
  const isVimeo = url.includes("vimeo.com");
  if (isVimeo) {
    try {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as OEmbedResponse;
        const lines: string[] = [`URL: ${url}`];
        if (data.title) lines.push(`タイトル: ${data.title}`);
        if (data.author_name) lines.push(`作者: ${data.author_name}`);
        return lines.join("\n");
      }
    } catch {
      // フォールバックへ
    }
  }

  // その他のURLはそのまま渡す
  return `URL: ${url}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.videoUrl || !body.label || !body.fieldDefs?.length) {
      return NextResponse.json({ error: "必要なパラメータが不足しています。" }, { status: 400 });
    }

    const metadata = await fetchVideoMetadata(body.videoUrl);

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const fieldSchema = body.fieldDefs
      .map((def) => `"${def.key}": "${def.label}に入る内容（具体的に）"`)
      .join(",\n  ");

    const prompt = [
      `あなたはAPモデル（Archeological Prototyping）の専門家です。`,
      `以下の動画・URLの情報を読んで、APモデルの「${body.label}」というモデル要素のフィールドを埋めてください。`,
      body.description ? `モデルの説明: ${body.description}` : "",
      ``,
      `【動画情報】`,
      metadata,
      ``,
      `動画のタイトルや内容から推測できる範囲で、以下のJSONフォーマットのみを返してください（前置きや説明は不要）：`,
      `{`,
      `  ${fieldSchema}`,
      `}`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "解析結果を取得できませんでした。" }, { status: 502 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIの返答形式が不正でした。" }, { status: 502 });
    }

    const suggestion = JSON.parse(jsonMatch[0]) as Record<string, string>;
    return NextResponse.json({ suggestion, metadata, model });
  } catch (error) {
    console.error("Failed to analyze video", error);
    return NextResponse.json({ error: "動画解析に失敗しました。" }, { status: 500 });
  }
}
