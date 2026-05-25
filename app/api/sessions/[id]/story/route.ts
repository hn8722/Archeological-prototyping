import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { SessionModel } from "@/lib/types/ap";
import {
  canReadSession,
  getSessionRecord,
  saveStoryDraft,
} from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

type StoryGraphNode = {
  key: string;
  generation: number;
  id: string;
  label: string;
  text: string | null;
};

type StoryGraphEdge = {
  key: string;
  kind: "same_generation" | "cross_generation";
  label: string;
  text: string | null;
  source: {
    generation: number;
    id: string;
    label: string;
  };
  target: {
    generation: number;
    id: string;
    label: string;
  };
};

type StoryGraph = {
  sessionName: string;
  generations: number[];
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  modelChanges: {
    templateId: string;
    label: string;
    generations: {
      generation: number;
      text: string | null;
    }[];
  }[];
};

type StoryParams = {
  genre?: string;
  perspective?: string;
  style?: string;
  characterNote?: string;
};

type StoryRequestBody = {
  params?: StoryParams;
  action?: "preview" | "generate";
  scenarioPlan?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const access = await canReadSession(id, user?.id);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションで小説生成する権限がありません。" }, { status: 403 });
    }
    const session = await getSessionRecord(id);
    if (!session) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as StoryRequestBody;
    const storyParams: StoryParams = body.params ?? {};
    const action = body.action ?? "generate";

    const client = getOpenAIClient();
    const model = getOpenAIModel();
    const storyGraph = buildStoryGraph(session);

    let scenarioPlan = body.scenarioPlan;

    if (action === "preview") {
      const scenarioResponse = await client.responses.create({
        model,
        input: buildScenarioOptionsPrompt(storyGraph, storyParams),
      });
      const previews = normalizeScenarioPreviews(scenarioResponse.output_text);
      if (previews.length === 0) {
        return NextResponse.json({ error: "方向性案を取得できませんでした。" }, { status: 502 });
      }
      return NextResponse.json({ previews, model });
    }

    if (!scenarioPlan) {
      const scenarioResponse = await client.responses.create({
        model,
        input: buildScenarioPrompt(storyGraph, storyParams),
      });
      scenarioPlan = normalizeScenarioPlan(scenarioResponse.output_text);
    }

    const storyResponse = await client.responses.create({
      model,
      input: buildStoryPrompt(storyGraph, scenarioPlan, storyParams),
    });

    const generationStories = normalizeGenerationStories(storyResponse.output_text);
    const story = generationStories.length > 0
      ? generationStories.map((item) => `第${item.generation}世代: ${item.title}\n${item.text}`).join("\n\n")
      : storyResponse.output_text?.trim();

    if (!story) {
      return NextResponse.json({ error: "小説生成結果を取得できませんでした。" }, { status: 502 });
    }

    await saveStoryDraft(session.id, story, model);

    return NextResponse.json({ story, generationStories, scenarioPlan, model });
  } catch (error) {
    console.error("Failed to generate story", error);
    return NextResponse.json(
      { error: getOpenAIErrorMessage(error, "小説生成に失敗しました。OPENAI_API_KEY、モデル設定、請求上限を確認してください。") },
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
    return "指定したOpenAIモデルが利用できません。OPENAI_MODELの設定、またはアカウントのモデル利用権限を確認してください。";
  }

  return process.env.NODE_ENV === "development" && openAIError.message
    ? `${fallback} (${openAIError.message})`
    : fallback;
}

function buildStoryGraph(session: SessionModel): StoryGraph {
  const generations = [...session.generations].sort(
    (first, second) => first.generationIndex - second.generationIndex
  );
  const crossGenerationEdgeIds = new Set(AP_CROSS_GENERATION_EDGES.map((edge) => edge.id));

  const nodes = generations.flatMap<StoryGraphNode>((generation) =>
    Object.entries(generation.nodes).map(([id, node]) => ({
      key: `${generation.generationIndex}:${id}`,
      generation: generation.generationIndex,
      id,
      label: node.label,
      text: getTextOrNull(node.text),
    }))
  );

  const sameGenerationEdges = generations.flatMap<StoryGraphEdge>((generation) =>
    Object.entries(generation.edges)
      .filter(([, edge]) => !crossGenerationEdgeIds.has(edge.templateId))
      .map(([id, edge]) => ({
        key: `${generation.generationIndex}:${id}`,
        kind: "same_generation",
        label: edge.label,
        text: getTextOrNull(edge.text),
        source: {
          generation: generation.generationIndex,
          id: edge.source,
          label: generation.nodes[edge.source]?.label ?? edge.source,
        },
        target: {
          generation: generation.generationIndex,
          id: edge.target,
          label: generation.nodes[edge.target]?.label ?? edge.target,
        },
      }))
  );

  const crossGenerationEdges = generations.flatMap<StoryGraphEdge>((generation, index) => {
    const nextGeneration = generations[index + 1];
    if (!nextGeneration) return [];

    return AP_CROSS_GENERATION_EDGES.map((templateEdge) => {
      const edge = generation.edges[templateEdge.id];

      return {
        key: `${generation.generationIndex}-${nextGeneration.generationIndex}:${templateEdge.id}`,
        kind: "cross_generation",
        label: edge?.label ?? templateEdge.label,
        text: getTextOrNull(edge?.text),
        source: {
          generation: generation.generationIndex,
          id: templateEdge.source,
          label: generation.nodes[templateEdge.source]?.label ?? templateEdge.source,
        },
        target: {
          generation: nextGeneration.generationIndex,
          id: templateEdge.target,
          label: nextGeneration.nodes[templateEdge.target]?.label ?? templateEdge.target,
        },
      };
    });
  });

  const nodeTemplateIds = unique(
    generations.flatMap((generation) =>
      Object.values(generation.nodes).map((node) => node.templateId)
    )
  );

  const modelChanges = nodeTemplateIds.map((templateId) => {
    const label =
      generations.map((generation) => generation.nodes[templateId]?.label).find(Boolean) ??
      templateId;

    return {
      templateId,
      label,
      generations: generations.map((generation) => ({
        generation: generation.generationIndex,
        text: getTextOrNull(generation.nodes[templateId]?.text),
      })),
    };
  });

  return {
    sessionName: session.name,
    generations: generations.map((generation) => generation.generationIndex),
    nodes,
    edges: [...sameGenerationEdges, ...crossGenerationEdges],
    modelChanges,
  };
}

function buildParamInstructions(params: StoryParams): string[] {
  const lines: string[] = [];
  if (params.genre && params.genre !== "指定なし") lines.push(`- ジャンル: ${params.genre}`);
  if (params.perspective && params.perspective !== "指定なし") lines.push(`- 視点: ${params.perspective}`);
  if (params.style && params.style !== "指定なし") lines.push(`- 文体: ${params.style}`);
  if (params.characterNote?.trim()) lines.push(`- 登場人物・設定メモ: ${params.characterNote.trim()}`);
  return lines;
}

function buildGraphText(storyGraph: StoryGraph): string {
  const lines: string[] = [];

  for (let i = 0; i < storyGraph.generations.length; i++) {
    const gen = storyGraph.generations[i];
    const nextGen = storyGraph.generations[i + 1];

    lines.push(`【世代${gen}】`);

    // Nodes
    const genNodes = storyGraph.nodes.filter((n) => n.generation === gen);
    lines.push("■ オブジェクト（ノード）");
    for (const node of genNodes) {
      const content = node.text ? `「${node.text}」` : "（未入力）";
      lines.push(`  - ${node.label}: ${content}`);
    }

    // Same-generation edges
    const sameEdges = storyGraph.edges.filter(
      (e) => e.kind === "same_generation" && e.source.generation === gen
    );
    if (sameEdges.length > 0) {
      lines.push("■ 同世代の変換（射）");
      for (const edge of sameEdges) {
        const content = edge.text ? ` ／ 補足:「${edge.text}」` : "";
        lines.push(`  - ${edge.source.label} →[${edge.label}]→ ${edge.target.label}${content}`);
      }
    }

    lines.push("");

    // Cross-generation bridge to next generation
    if (nextGen !== undefined) {
      const crossEdges = storyGraph.edges.filter(
        (e) =>
          e.kind === "cross_generation" &&
          e.source.generation === gen &&
          e.target.generation === nextGen
      );
      if (crossEdges.length > 0) {
        lines.push(`【世代${gen} → 世代${nextGen} の橋渡し（時代を超えた影響）】`);
        for (const edge of crossEdges) {
          const content = edge.text ? ` ／ 補足:「${edge.text}」` : "";
          lines.push(
            `  - ${edge.source.label}（世代${gen}）→[${edge.label}]→ ${edge.target.label}（世代${nextGen}）${content}`
          );
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function buildScenarioPrompt(storyGraph: StoryGraph, params: StoryParams) {
  const paramLines = buildParamInstructions(params);
  return [
    "あなたはAPモデルを物語化するための脚本設計者です。",
    "以下のAP_GRAPHは、時間軸上のAPモデルをグラフ構造で示したものです。",
    "世代の順番（世代1 → 世代2 → …）は時系列を表します。",
    "「→[矢印ラベル]→」は必ず左から右への影響・変化として解釈し、逆方向に読まないでください。",
    "「世代X → 世代Y の橋渡し」は、前の時代から次の時代への継承・変容・断絶を表します。",
    "APモデルから登場人物や舞台を自然に推測して設定してください。",
    "未入力（「未入力」と書かれた項目）があっても止めず、入力済みの内容と矢印構造を優先してください。",
    "出力はJSONだけにしてください。Markdownや説明文は不要です。",
    ...(paramLines.length > 0 ? ["", "USER_PARAMS（以下の指定を最優先で守ること）:", ...paramLines] : []),
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      mainTheme: "string",
      openingLine: "string（小説の最初の一行。本文生成前にユーザーへ確認する）",
      setting: {
        place: "string",
        time: "string",
        socialContext: "string",
      },
      characters: [
        {
          name: "string",
          role: "string",
          desire: "string",
          conflict: "string",
        },
      ],
      generationBeats: [
        {
          generation: "number",
          storyRole: "string（この世代が物語で果たす役割）",
          keyChange: "string（この世代で起きる最も重要な変化）",
          scene: "string（代表的な場面描写のヒント）",
        },
      ],
      plotBeats: [
        {
          order: "number",
          sourceLabel: "string（起点モデルのラベル）",
          arrowLabel: "string（矢印のラベル）",
          targetLabel: "string（終点モデルのラベル）",
          event: "string（この矢印が引き起こす出来事・変化）",
        },
      ],
    }),
    "",
    "AP_GRAPH:",
    buildGraphText(storyGraph),
  ].join("\n");
}

function buildScenarioOptionsPrompt(storyGraph: StoryGraph, params: StoryParams) {
  const paramLines = buildParamInstructions(params);
  const scenarioSchema = {
    mainTheme: "string",
    openingLine: "string（小説の最初の一行。本文生成前にユーザーへ確認する）",
    directionLabel: "string（方向性の短い名前。例: 静かな日常劇、社会派SF、世代継承ドラマ）",
    directionNote: "string（この案が他の案とどう違うかを1〜2文で説明）",
    setting: {
      place: "string",
      time: "string",
      socialContext: "string",
    },
    characters: [
      {
        name: "string",
        role: "string",
        desire: "string",
        conflict: "string",
      },
    ],
    generationBeats: [
      {
        generation: "number",
        storyRole: "string（この世代が物語で果たす役割）",
        keyChange: "string（この世代で起きる最も重要な変化）",
        scene: "string（代表的な場面描写のヒント）",
      },
    ],
    plotBeats: [
      {
        order: "number",
        sourceLabel: "string（起点モデルのラベル）",
        arrowLabel: "string（矢印のラベル）",
        targetLabel: "string（終点モデルのラベル）",
        event: "string（この矢印が引き起こす出来事・変化）",
      },
    ],
  };

  return [
    "あなたはAPモデルを物語化するための脚本設計者です。",
    "以下のAP_GRAPHから、互いに明確に違う小説の方向性案を3つ作ってください。",
    "3案は、テーマ、語り口、主人公/焦点、葛藤の置き方が重複しないようにしてください。",
    "世代の順番（世代1 → 世代2 → …）は時系列を表します。",
    "「→[矢印ラベル]→」は必ず左から右への影響・変化として解釈し、逆方向に読まないでください。",
    "「世代X → 世代Y の橋渡し」は、前の時代から次の時代への継承・変容・断絶を表します。",
    "未入力（「未入力」と書かれた項目）があっても止めず、入力済みの内容と矢印構造を優先してください。",
    "出力はJSONだけにしてください。Markdownや説明文は不要です。",
    ...(paramLines.length > 0 ? ["", "USER_PARAMS（以下の指定を最優先で守ること）:", ...paramLines] : []),
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      options: [scenarioSchema, scenarioSchema, scenarioSchema],
    }),
    "",
    "AP_GRAPH:",
    buildGraphText(storyGraph),
  ].join("\n");
}

function buildStoryPrompt(storyGraph: StoryGraph, scenarioPlan: string, params: StoryParams) {
  const paramLines = buildParamInstructions(params);
  return [
    "あなたは短編小説の作家です。",
    "以下のAP_GRAPHとSCENARIO_PLAN_JSONに基づいて、日本語の短い小説本文を書いてください。",
    "登場人物、舞台、時代設定はSCENARIO_PLAN_JSONに従ってください。",
    "AP_GRAPHの矢印「→[ラベル]→」は左から右への影響・変化として扱い、逆方向に解釈しないでください。",
    "世代の順番は時系列です。第一世代から最後の世代へ、変化・継承・断絶が物語として自然につながるようにしてください。",
    "「世代X → 世代Y の橋渡し」の射は、時代を超えた影響や転換点として物語に織り込んでください。",
    "未入力の項目は無理に補完しすぎず、入力済みの内容から推測できる範囲で物語化してください。",
    "世代ごとに分けて出力してください。各世代は、その世代の変化や出来事に対応する独立した短い本文にしてください。",
    "第一世代の本文は、SCENARIO_PLAN_JSONのopeningLineを自然な最初の一行として始めてください。",
    "出力はJSONだけにしてください。Markdownや説明文は不要です。",
    ...(paramLines.length > 0 ? ["", "USER_PARAMS（以下の指定を最優先で守ること）:", ...paramLines] : []),
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      generations: [
        {
          generation: "number",
          title: "string",
          text: "string（2〜4段落。抽象論だけでなく、生活の場面や登場人物の行動が見える本文）",
        },
      ],
    }),
    "",
    "SCENARIO_PLAN_JSON:",
    scenarioPlan,
    "",
    "AP_GRAPH:",
    buildGraphText(storyGraph),
  ].join("\n");
}

function extractScenarioPreview(scenarioPlan: string) {
  try {
    const parsed = JSON.parse(scenarioPlan) as {
      mainTheme?: string;
      openingLine?: string;
      directionLabel?: string;
      directionNote?: string;
      rawPlan?: string;
    };
    return {
      theme: parsed.mainTheme || "テーマを取得できませんでした",
      openingLine: parsed.openingLine || "最初の一行を取得できませんでした",
      directionLabel: parsed.directionLabel || "方向性案",
      directionNote: parsed.directionNote || "",
    };
  } catch {
    return {
      theme: "テーマを取得できませんでした",
      openingLine: "最初の一行を取得できませんでした",
      directionLabel: "方向性案",
      directionNote: "",
    };
  }
}

function normalizeScenarioPreviews(outputText?: string) {
  const text = outputText?.trim();
  if (!text) return [] as {
    theme: string;
    openingLine: string;
    directionLabel: string;
    directionNote: string;
    scenarioPlan: string;
  }[];

  try {
    const parsed = JSON.parse(extractJsonObject(text)) as { options?: unknown[] };
    const options = Array.isArray(parsed.options) ? parsed.options : [];
    return options.slice(0, 3).map((option, index) => {
      const scenarioPlan = JSON.stringify(option, null, 2);
      const preview = extractScenarioPreview(scenarioPlan);
      return {
        ...preview,
        directionLabel: preview.directionLabel || `案${index + 1}`,
        scenarioPlan,
      };
    });
  } catch {
    const scenarioPlan = normalizeScenarioPlan(text);
    return [{ ...extractScenarioPreview(scenarioPlan), scenarioPlan }];
  }
}

function normalizeGenerationStories(outputText?: string) {
  const text = outputText?.trim();
  if (!text) return [] as { generation: number; title: string; text: string }[];

  try {
    const parsed = JSON.parse(extractJsonObject(text)) as {
      generations?: { generation?: number; title?: string; text?: string }[];
    };

    return (parsed.generations ?? [])
      .filter((item) => item.generation && item.text?.trim())
      .map((item) => ({
        generation: item.generation as number,
        title: item.title?.trim() || `第${item.generation}世代`,
        text: item.text?.trim() ?? "",
      }));
  } catch {
    return [];
  }
}

function normalizeScenarioPlan(outputText?: string) {
  const text = outputText?.trim();
  if (!text) return "{}";

  const jsonText = extractJsonObject(text);

  try {
    return JSON.stringify(JSON.parse(jsonText), null, 2);
  } catch {
    return JSON.stringify({ rawPlan: text }, null, 2);
  }
}

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch?.[1]) return fencedMatch[1];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  return text;
}

function getTextOrNull(text?: string | null) {
  const normalized = text?.trim();
  return normalized || null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
