import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { SessionModel } from "@/lib/types/ap";
import {
  buildInitialSession,
  getSessionRecord,
  saveSessionRecord,
  saveStoryDraft,
} from "@/lib/server/session-store";

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

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let session = await getSessionRecord(id);

    if (!session) {
      session = await saveSessionRecord(buildInitialSession(id));
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();
    const storyGraph = buildStoryGraph(session);

    const scenarioResponse = await client.responses.create({
      model,
      input: buildScenarioPrompt(storyGraph),
    });
    const scenarioPlan = normalizeScenarioPlan(scenarioResponse.output_text);

    const storyResponse = await client.responses.create({
      model,
      input: buildStoryPrompt(storyGraph, scenarioPlan),
    });

    const story = storyResponse.output_text?.trim();

    if (!story) {
      return NextResponse.json({ error: "小説生成結果を取得できませんでした。" }, { status: 502 });
    }

    await saveStoryDraft(session.id, story, model);

    return NextResponse.json({ story, model });
  } catch (error) {
    console.error("Failed to generate story", error);
    return NextResponse.json(
      { error: "小説生成に失敗しました。OPENAI_API_KEY の設定も確認してください。" },
      { status: 500 }
    );
  }
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

function buildScenarioPrompt(storyGraph: StoryGraph) {
  return [
    "あなたはAPモデルを物語化するための脚本設計者です。",
    "以下のAP_GRAPH_JSONは、時間軸上のAPモデルを構造化したデータです。",
    "矢印は必ず source から target への影響・変化として解釈し、逆方向に読まないでください。",
    "ユーザーに登場人物や舞台は入力させません。APモデルから自然に推測して設定してください。",
    "未入力の項目があっても止めず、入力済みの text と矢印構造を優先してください。",
    "出力はJSONだけにしてください。Markdownや説明文は不要です。",
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      mainTheme: "string",
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
          storyRole: "string",
          keyChange: "string",
          scene: "string",
        },
      ],
      plotBeats: [
        {
          order: "number",
          source: "string",
          target: "string",
          event: "string",
        },
      ],
    }),
    "",
    "AP_GRAPH_JSON:",
    JSON.stringify(storyGraph),
  ].join("\n");
}

function buildStoryPrompt(storyGraph: StoryGraph, scenarioPlan: string) {
  return [
    "あなたは短編小説の作家です。",
    "以下のAP_GRAPH_JSONとSCENARIO_PLAN_JSONに基づいて、日本語の短い小説本文を書いてください。",
    "登場人物、舞台、時代設定はSCENARIO_PLAN_JSONに従ってください。",
    "AP_GRAPH_JSONの矢印は source から target への影響・変化として扱い、逆方向に解釈しないでください。",
    "第一世代から最後の世代までの変化、継承、断絶、同じモデルの違いが物語として自然につながるようにしてください。",
    "未入力の項目は無理に補完しすぎず、入力済みの項目から推測できる範囲で物語化してください。",
    "条件:",
    "- 3〜6段落",
    "- 抽象論だけでなく、生活の場面や登場人物の行動が見えるようにする",
    "- 余計な見出しや箇条書きは付けず、本文のみ返す",
    "",
    "SCENARIO_PLAN_JSON:",
    scenarioPlan,
    "",
    "AP_GRAPH_JSON:",
    JSON.stringify(storyGraph),
  ].join("\n");
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
