import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { canUseSessionAi, WORKSHOP_PARTICIPANT_COOKIE } from "@/lib/server/session-store";
import { AP_CROSS_GENERATION_EDGES, AP_TEMPLATE_EDGES, AP_TEMPLATE_NODES } from "@/lib/templates/apTemplate";
import { FieldDef } from "@/lib/templates/fieldSchema";
import { MODEL_DESCRIPTIONS } from "@/lib/templates/modelDescriptions";

type SessionEntry = {
  label: string;
  fields: Record<string, string>;
  text: string | null;
};

type RequestBody = {
  sessionId?: string;
  label?: string;
  description?: string;
  fieldDefs?: FieldDef[];
  currentFields?: Record<string, string>;
  sessionNodes?: SessionEntry[];
  sessionEdges?: SessionEntry[];
};

function buildApGuidance(targetLabel: string) {
  const allEdges = [...AP_TEMPLATE_EDGES, ...AP_CROSS_GENERATION_EDGES];
  const targetNode = AP_TEMPLATE_NODES.find((node) => node.label === targetLabel);
  const targetEdge = allEdges.find((edge) => edge.label === targetLabel);
  const lines = [
    "APは、社会・文化の変化を複数のモデル要素と関係で記述するための枠組みです。",
    "今回のAIアシストでは、AP全体を推測で埋めるのではなく、選択中のモデルと直接関係する範囲だけを補助します。",
  ];

  if (targetNode) {
    const localEdges = allEdges.filter((edge) => edge.source === targetNode.id || edge.target === targetNode.id);
    const relatedNodeIds = new Set(
      localEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== targetNode.id)
    );
    const relatedNodes = AP_TEMPLATE_NODES.filter((node) => relatedNodeIds.has(node.id));

    lines.push("", `[対象モデルの定義]`, `${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "定義なし"}`);
    if (relatedNodes.length > 0) {
      lines.push(
        "",
        "[直接関係するモデル]",
        ...relatedNodes.map((node) => `- ${node.label}: ${MODEL_DESCRIPTIONS[node.label] ?? "定義なし"}`)
      );
    }
    if (localEdges.length > 0) {
      lines.push(
        "",
        "[直接関係する変換]",
        ...localEdges.map((edge) => {
          const source = AP_TEMPLATE_NODES.find((node) => node.id === edge.source)?.label ?? edge.source;
          const target = AP_TEMPLATE_NODES.find((node) => node.id === edge.target)?.label ?? edge.target;
          return `- ${source} --${edge.label}--> ${target}: ${MODEL_DESCRIPTIONS[edge.label] ?? "定義なし"}`;
        })
      );
    }
  } else if (targetEdge) {
    const source = AP_TEMPLATE_NODES.find((node) => node.id === targetEdge.source)?.label ?? targetEdge.source;
    const target = AP_TEMPLATE_NODES.find((node) => node.id === targetEdge.target)?.label ?? targetEdge.target;
    lines.push(
      "",
      "[対象モデルの定義]",
      `${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "定義なし"}`,
      "",
      "[この変換がつなぐモデル]",
      `- 変換元: ${source}: ${MODEL_DESCRIPTIONS[source] ?? "定義なし"}`,
      `- 変換先: ${target}: ${MODEL_DESCRIPTIONS[target] ?? "定義なし"}`
    );
  } else {
    lines.push("", "[対象モデルの定義]", `${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "定義なし"}`);
  }

  return lines.join("\n");
}

function buildCurrentFieldsText(fieldDefs: FieldDef[] | undefined, currentFields: Record<string, string> | undefined) {
  if (!fieldDefs?.length) return "すべて未入力";
  return fieldDefs
    .map((def) => {
      const value = currentFields?.[def.key]?.trim();
      return `- ${def.label}: ${value || "未入力"}`;
    })
    .join("\n");
}

function buildRelatedContext(nodes: SessionEntry[] | undefined, edges: SessionEntry[] | undefined) {
  const filledNodes = (nodes ?? [])
    .filter((node) => node.text?.trim())
    .map((node) => `[${node.label}]: ${node.text}`);
  const filledEdges = (edges ?? [])
    .filter((edge) => edge.text?.trim())
    .map((edge) => `[${edge.label}]: ${edge.text}`);
  const items = [...filledNodes, ...filledEdges];
  return items.length > 0 ? items.join("\n") : "なし";
}

function buildOutputSchema(fieldDefs: FieldDef[] | undefined) {
  return Object.fromEntries((fieldDefs ?? []).map((def) => [def.key, `${def.label}に入る提案文`]));
}

function buildAssistPrompt(body: RequestBody) {
  const label = body.label ?? "";
  const modelDescription = body.description ?? MODEL_DESCRIPTIONS[label] ?? "定義なし";
  const currentFieldsText = buildCurrentFieldsText(body.fieldDefs, body.currentFields);
  const relatedContext = buildRelatedContext(body.sessionNodes, body.sessionEdges);
  const outputSchema = buildOutputSchema(body.fieldDefs);

  return [
    "あなたはArcheological Prototyping（AP）の入力支援者です。",
    "ユーザーが現在入力している内容を最優先し、選択中のモデルの各項目を補完・整形してください。",
    "",
    "[最重要ルール]",
    "1. 現在の入力内容を最優先する。固有名詞、対象、時期、場所、行為、因果関係は勝手に変更しない。",
    "2. 関連する入力済み内容は、矛盾を避けるための参考にだけ使う。現在の入力を上書きしない。",
    "3. 未入力欄を補う場合も、入力済み欄から自然に言える範囲に留める。",
    "4. どの入力にも使える抽象文ではなく、現在の入力に含まれる具体語を必ず反映する。",
    "5. 現在の入力にない製品名、組織名、数値、事例は作らない。",
    "6. 関連する入力済み内容の文章をそのまま流用しない。",
    "",
    "[対象モデル]",
    `名前: ${label}`,
    `定義: ${modelDescription}`,
    "",
    buildApGuidance(label),
    "",
    "[現在の入力内容]",
    currentFieldsText,
    "",
    "[関連する入力済み内容]",
    relatedContext,
    "",
    "[出力形式]",
    "説明文や前置きは不要。次のキーだけを持つJSONオブジェクトを返す。",
    JSON.stringify(outputSchema, null, 2),
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.label) {
      return NextResponse.json({ error: "対象モデルが指定されていません。" }, { status: 400 });
    }

    if (!body.sessionId) {
      return NextResponse.json({ error: "セッション情報が指定されていません。" }, { status: 401 });
    }

    const user = await getUser();
    const participantToken = (await cookies()).get(WORKSHOP_PARTICIPANT_COOKIE)?.value;
    const aiAccess = await canUseSessionAi(body.sessionId, user?.id, user?.email, participantToken);
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: "このセッションではAIを利用できません。" }, { status: 403 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();
    const prompt = buildAssistPrompt(body);

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "AIアシスト結果を取得できませんでした。" }, { status: 502 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIの返答形式が不正でした。" }, { status: 502 });
    }

    const suggestion = JSON.parse(jsonMatch[0]) as Record<string, string>;
    return NextResponse.json({ suggestion, model });
  } catch (error) {
    console.error("Failed to generate assist text", error);
    return NextResponse.json(
      { error: "AIアシストの生成に失敗しました。OPENAI_API_KEY の設定も確認してください。" },
      { status: 500 }
    );
  }
}
