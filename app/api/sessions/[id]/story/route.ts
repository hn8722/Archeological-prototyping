import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { SessionModel } from "@/lib/types/ap";
import {
  canWriteSession,
  canUseSessionAi,
  canReadSession,
  getSessionRecord,
  saveStoryDraft,
  WORKSHOP_PARTICIPANT_COOKIE,
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
};

type StoryParams = {
  genre?: string;
  perspective?: string;
  style?: string;
  characterNote?: string;
};

type SelectedPersona = {
  key: string;
  generation: number;
  entryIndex: number;
  text: string;
  fields?: Record<string, string>;
};

type StoryRequestBody = {
  params?: StoryParams;
  action?: "preview" | "generate" | "save";
  scenarioPlan?: string;
  story?: string;
  model?: string;
  selectedPersonas?: SelectedPersona[];
};

type GenerationStory = {
  generation: number;
  title: string;
  text: string;
  carryover?: string;
};

const AP_DEFINITION_TEXT = [
  "AP（Archeological Prototyping）は、制度、日常の空間とユーザー体験、前衛的社会問題、社会の目標、技術や資源、ペルソナの6つのオブジェクトと、それらを変換する矢印から社会変化を読むモデルです。",
  "同世代の矢印は同じ時代内の変換を示し、世代をまたぐ矢印は過去から未来への影響や変化を示します。",
  "小説ではAP用語を説明するのではなく、APの関係を人物の行動、場面、葛藤、選択として描きます。",
].join("\n");

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = (await cookies()).get(WORKSHOP_PARTICIPANT_COOKIE)?.value;
    const access = await canReadSession(id, user?.id, user?.email, participantToken);
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

    const body = (await request.json().catch(() => ({}))) as StoryRequestBody;
    const storyParams: StoryParams = body.params ?? {};
    const action = body.action ?? "generate";
    const model = getOpenAIModel();

    if (action === "save") {
      const writeAccess = await canWriteSession(id, user?.id, user?.email, participantToken);
      if (!writeAccess.allowed) {
        return NextResponse.json({ error: "このセッションに小説を保存する権限がありません。" }, { status: 403 });
      }

      const storyToSave = body.story?.trim();
      if (!storyToSave) {
        return NextResponse.json({ error: "保存する小説本文が必要です。" }, { status: 400 });
      }

      const draft = await saveStoryDraft(session.id, storyToSave, body.model ?? model);
      return NextResponse.json({ storyDraft: { id: draft.id, createdAt: draft.createdAt } });
    }

    const selectedPersonas = body.selectedPersonas ?? [];
    if (selectedPersonas.length === 0) {
      return NextResponse.json({ error: "小説生成に使うペルソナを選択してください。" }, { status: 400 });
    }

    const aiAccess = await canUseSessionAi(id, user?.id, user?.email, participantToken);
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: "このセッションではAI利用が停止されています。" }, { status: 403 });
    }

    const client = getOpenAIClient();
    const storyGraph = buildStoryGraph(session);

    if (action === "preview") {
      const scenarioResponse = await client.responses.create({
        model,
        input: buildScenarioOptionsPrompt(storyGraph, storyParams, selectedPersonas),
      });
      const previews = normalizeScenarioPreviews(scenarioResponse.output_text);
      if (previews.length === 0) {
        return NextResponse.json({ error: "方向性案を取得できませんでした。" }, { status: 502 });
      }
      return NextResponse.json({ previews, model });
    }

    const scenarioPlan = body.scenarioPlan ?? "{}";
    const generationStories = await generateSequentialStories({
      client,
      model,
      storyGraph,
      scenarioPlan,
      storyParams,
      selectedPersonas,
    });
    const story = generationStories.map((item) => item.text).join("\n\n");

    if (!story.trim()) {
      return NextResponse.json({ error: "小説生成結果を取得できませんでした。" }, { status: 502 });
    }

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
    return "OpenAI APIの請求上限に達しています。Billingのhard limitまたは利用上限を確認してください。";
  }
  if (openAIError.code === "insufficient_quota") {
    return "OpenAI APIの利用枠が不足しています。Billing、usage limits、支払い設定を確認してください。";
  }
  if (openAIError.status === 401) {
    return "OPENAI_API_KEYが無効、または期限切れの可能性があります。";
  }
  if (openAIError.status === 404 || openAIError.code === "model_not_found") {
    return "指定したOpenAIモデルが利用できません。OPENAI_MODELの設定を確認してください。";
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

  return {
    sessionName: session.name,
    generations: generations.map((generation) => generation.generationIndex),
    nodes,
    edges: [...sameGenerationEdges, ...crossGenerationEdges],
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

function buildPersonasText(personas: SelectedPersona[]) {
  return personas
    .map((persona, index) => {
      const fields = persona.fields
        ? Object.entries(persona.fields)
            .filter(([, value]) => value?.trim())
            .map(([key, value]) => `${key}: ${value}`)
            .join(" / ")
        : "";
      return [
        `Persona ${index + 1} (世代 ${persona.generation})`,
        `- summary: ${persona.text}`,
        fields ? `- fields: ${fields}` : null,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function buildGraphText(storyGraph: StoryGraph): string {
  return storyGraph.generations.map((generation) => buildGenerationGraphText(storyGraph, generation, "full")).join("\n\n");
}

function buildGenerationGraphText(
  storyGraph: StoryGraph,
  generation: number,
  mode: "full" | "generation"
): string {
  const lines: string[] = [`【世代 ${generation}】`];
  const genNodes = storyGraph.nodes.filter((node) => node.generation === generation && node.text);
  const sameEdges = storyGraph.edges.filter(
    (edge) => edge.kind === "same_generation" && edge.source.generation === generation && edge.text
  );
  const outgoingCrossEdges = storyGraph.edges.filter(
    (edge) => edge.kind === "cross_generation" && edge.source.generation === generation && edge.text
  );

  if (genNodes.length > 0) {
    lines.push("■ オブジェクト");
    for (const node of genNodes) {
      lines.push(`- ${node.label}: ${node.text}`);
    }
  }

  if (sameEdges.length > 0) {
    lines.push("■ 同世代の変換");
    for (const edge of sameEdges) {
      lines.push(`- ${edge.source.label} → [${edge.label}] → ${edge.target.label}: ${edge.text}`);
    }
  }

  if (outgoingCrossEdges.length > 0) {
    lines.push("■ 次世代への橋渡し");
    for (const edge of outgoingCrossEdges) {
      lines.push(
        `- ${edge.source.label}(世代${edge.source.generation}) → [${edge.label}] → ${edge.target.label}(世代${edge.target.generation}): ${edge.text}`
      );
    }
  }

  if (mode === "generation" && lines.length === 1) {
    lines.push("入力済みのAP要素はありません。");
  }

  return lines.join("\n");
}

function buildScenarioOptionsPrompt(
  storyGraph: StoryGraph,
  params: StoryParams,
  selectedPersonas: SelectedPersona[]
) {
  const paramLines = buildParamInstructions(params);
  const scenarioSchema = {
    mainTheme: "string",
    openingLine: "string",
    directionLabel: "string",
    directionNote: "string",
    protagonistPolicy: "string",
    storyArc: "string",
  };

  return [
    "あなたはAPモデルを未来小説に変換する編集者です。",
    "以下のAP_GRAPHとSELECTED_PERSONASをもとに、互いに異なる小説の方向性案を3つ作ってください。",
    "小説は、ユーザーが記述した一番過去の世代から最後の未来世代まで、世代ごとに段階的に生成されます。",
    "方向性案では、どのペルソナをどのような主人公/群像として扱うかを明確にしてください。",
    "出力はJSONだけにしてください。",
    ...(paramLines.length > 0 ? ["", "USER_PARAMS:", ...paramLines] : []),
    "",
    "JSON_SCHEMA:",
    JSON.stringify({ options: [scenarioSchema, scenarioSchema, scenarioSchema] }),
    "",
    "AP_DEFINITION:",
    AP_DEFINITION_TEXT,
    "",
    "SELECTED_PERSONAS:",
    buildPersonasText(selectedPersonas),
    "",
    "AP_GRAPH:",
    buildGraphText(storyGraph),
  ].join("\n");
}

async function generateSequentialStories({
  client,
  model,
  storyGraph,
  scenarioPlan,
  storyParams,
  selectedPersonas,
}: {
  client: ReturnType<typeof getOpenAIClient>;
  model: string;
  storyGraph: StoryGraph;
  scenarioPlan: string;
  storyParams: StoryParams;
  selectedPersonas: SelectedPersona[];
}) {
  const targetGenerations = getWrittenGenerations(storyGraph);
  const generations = targetGenerations.length > 0 ? targetGenerations : storyGraph.generations;
  const generationStories: GenerationStory[] = [];
  let carryover = "";
  let previousLastSentence = "";

  for (const generation of generations) {
    const storyResponse = await client.responses.create({
      model,
      input: buildGenerationStoryPrompt({
        storyGraph,
        generation,
        scenarioPlan,
        storyParams,
        selectedPersonas,
        carryover,
        previousLastSentence,
      }),
    });

    const parsedStory = normalizeSingleGenerationStory(storyResponse.output_text, generation);
    generationStories.push(parsedStory);

    const carryoverResponse = await client.responses.create({
      model,
      input: buildCarryoverPrompt({
        generation,
        previousCarryover: carryover,
        storyText: parsedStory.text,
      }),
    });

    carryover = normalizeCarryover(carryoverResponse.output_text);
    previousLastSentence = extractLastSentence(parsedStory.text);
    generationStories[generationStories.length - 1] = {
      ...parsedStory,
      carryover,
    };
  }

  return generationStories;
}

function getWrittenGenerations(storyGraph: StoryGraph) {
  return storyGraph.generations.filter((generation) => {
    const hasNode = storyGraph.nodes.some((node) => node.generation === generation && node.text);
    const hasEdge = storyGraph.edges.some((edge) => edge.source.generation === generation && edge.text);
    return hasNode || hasEdge;
  });
}

function buildGenerationStoryPrompt({
  storyGraph,
  generation,
  scenarioPlan,
  storyParams,
  selectedPersonas,
  carryover,
  previousLastSentence,
}: {
  storyGraph: StoryGraph;
  generation: number;
  scenarioPlan: string;
  storyParams: StoryParams;
  selectedPersonas: SelectedPersona[];
  carryover: string;
  previousLastSentence: string;
}) {
  const paramLines = buildParamInstructions(storyParams);
  return [
    "あなたは日本語の短編小説家です。",
    "AP用語を本文中で説明しすぎず、人物の行動・場面・会話・沈黙として描いてください。",
    "この呼び出しでは、指定された1世代分の本文だけを書きます。",
    "前話の最後の一文がある場合、その文の続きを自然に受けるように書いてください。",
    "本文には「世代0」「第1世代」「AP」などのカテゴリ名や見出しを入れないでください。",
    "未入力のAP要素を無理に補完しすぎず、入力済みの内容とペルソナを優先してください。",
    "出力はJSONだけにしてください。",
    ...(paramLines.length > 0 ? ["", "USER_PARAMS:", ...paramLines] : []),
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      generation: "number",
      title: "string",
      text: "string",
    }),
    "",
    "AP_DEFINITION:",
    AP_DEFINITION_TEXT,
    "",
    "SCENARIO_PLAN_JSON:",
    scenarioPlan,
    "",
    "SELECTED_PERSONAS:",
    buildPersonasText(selectedPersonas),
    "",
    "PREVIOUS_LAST_SENTENCE:",
    previousLastSentence || "なし",
    "",
    "CARRYOVER_FROM_PREVIOUS_GENERATIONS:",
    carryover || "なし",
    "",
    "CURRENT_GENERATION_AP:",
    buildGenerationGraphText(storyGraph, generation, "generation"),
  ].join("\n");
}

function buildCarryoverPrompt({
  generation,
  previousCarryover,
  storyText,
}: {
  generation: number;
  previousCarryover: string;
  storyText: string;
}) {
  return [
    "あなたは連続小説の編集者です。",
    "以下の本文から、次世代の小説生成に引き継ぐべき制作メモだけを短く抽出してください。",
    "本文の文体を真似せず、要約・未解決の問い・主人公の変化・次世代で回収すべき要素に絞ってください。",
    "小説本文は出力しないでください。JSONだけにしてください。",
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      carryover: "string",
    }),
    "",
    "PREVIOUS_CARRYOVER:",
    previousCarryover || "なし",
    "",
    `GENERATION: ${generation}`,
    "",
    "STORY_TEXT:",
    storyText,
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

function normalizeSingleGenerationStory(outputText: string | undefined, fallbackGeneration: number) {
  const text = outputText?.trim();
  if (!text) {
    return { generation: fallbackGeneration, title: "", text: "" };
  }

  try {
    const parsed = JSON.parse(extractJsonObject(text)) as {
      generation?: number;
      title?: string;
      text?: string;
    };
    return {
      generation: typeof parsed.generation === "number" ? parsed.generation : fallbackGeneration,
      title: parsed.title?.trim() || "",
      text: parsed.text?.trim() || text,
    };
  } catch {
    return {
      generation: fallbackGeneration,
      title: "",
      text,
    };
  }
}

function normalizeCarryover(outputText?: string) {
  const text = outputText?.trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(extractJsonObject(text)) as { carryover?: string };
    return parsed.carryover?.trim() || "";
  } catch {
    return text;
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

function extractLastSentence(text: string) {
  const normalized = text.trim();
  if (!normalized) return "";
  const sentences = normalized
    .split(/(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  return sentences.at(-1) ?? normalized.slice(-160);
}

function getTextOrNull(text?: string | null) {
  const normalized = text?.trim();
  return normalized || null;
}
