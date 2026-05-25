import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { SessionModel } from "@/lib/types/ap";

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
  source: { generation: number; id: string; label: string };
  target: { generation: number; id: string; label: string };
};

type StoryGraph = {
  sessionName: string;
  generations: number[];
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
};

type RequestBody = {
  snapshots: string[]; // 複数セッションのJSONスナップショット
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.snapshots?.length) {
      return NextResponse.json({ error: "snapshots が必要です。" }, { status: 400 });
    }

    const sessions = body.snapshots.map((s) => JSON.parse(s) as SessionModel);
    const graphs = sessions.map((s, i) => buildStoryGraph(s, i));

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const scenarioResponse = await client.responses.create({
      model,
      input: buildMultiScenarioPrompt(graphs),
    });
    const scenarioPlan = normalizeScenarioPlan(scenarioResponse.output_text);

    const storyResponse = await client.responses.create({
      model,
      input: buildMultiStoryPrompt(graphs, scenarioPlan),
    });

    const story = storyResponse.output_text?.trim();
    if (!story) {
      return NextResponse.json({ error: "小説生成結果を取得できませんでした。" }, { status: 502 });
    }

    return NextResponse.json({ story, model });
  } catch (error) {
    console.error("Failed to generate gallery story", error);
    return NextResponse.json({ error: "小説生成に失敗しました。" }, { status: 500 });
  }
}

function buildStoryGraph(session: SessionModel, participantIndex: number): StoryGraph {
  const generations = [...session.generations].sort(
    (a, b) => a.generationIndex - b.generationIndex
  );
  const crossEdgeIds = new Set(AP_CROSS_GENERATION_EDGES.map((e) => e.id));

  const nodes = generations.flatMap<StoryGraphNode>((gen) =>
    Object.entries(gen.nodes).map(([id, node]) => ({
      key: `P${participantIndex}:${gen.generationIndex}:${id}`,
      generation: gen.generationIndex,
      id,
      label: node.label,
      text: node.text?.trim() || null,
    }))
  );

  const sameEdges = generations.flatMap<StoryGraphEdge>((gen) =>
    Object.entries(gen.edges)
      .filter(([, e]) => !crossEdgeIds.has(e.templateId))
      .map(([id, edge]) => ({
        key: `P${participantIndex}:${gen.generationIndex}:${id}`,
        kind: "same_generation" as const,
        label: edge.label,
        text: edge.text?.trim() || null,
        source: { generation: gen.generationIndex, id: edge.source, label: gen.nodes[edge.source]?.label ?? edge.source },
        target: { generation: gen.generationIndex, id: edge.target, label: gen.nodes[edge.target]?.label ?? edge.target },
      }))
  );

  const crossEdges = generations.flatMap<StoryGraphEdge>((gen, i) => {
    const next = generations[i + 1];
    if (!next) return [];
    return AP_CROSS_GENERATION_EDGES.map((tmpl) => {
      const edge = gen.edges[tmpl.id];
      return {
        key: `P${participantIndex}:${gen.generationIndex}-${next.generationIndex}:${tmpl.id}`,
        kind: "cross_generation" as const,
        label: edge?.label ?? tmpl.label,
        text: edge?.text?.trim() || null,
        source: { generation: gen.generationIndex, id: tmpl.source, label: gen.nodes[tmpl.source]?.label ?? tmpl.source },
        target: { generation: next.generationIndex, id: tmpl.target, label: next.nodes[tmpl.target]?.label ?? tmpl.target },
      };
    });
  });

  return {
    sessionName: session.name,
    generations: generations.map((g) => g.generationIndex),
    nodes,
    edges: [...sameEdges, ...crossEdges],
  };
}

function buildGraphText(graph: StoryGraph, label: string): string {
  const lines: string[] = [`=== ${label}（${graph.sessionName}）===`];

  for (let i = 0; i < graph.generations.length; i++) {
    const gen = graph.generations[i];
    const nextGen = graph.generations[i + 1];

    lines.push(`【世代${gen}】`);

    const genNodes = graph.nodes.filter((n) => n.generation === gen);
    lines.push("■ オブジェクト");
    for (const node of genNodes) {
      lines.push(`  - ${node.label}: ${node.text ? `「${node.text}」` : "（未入力）"}`);
    }

    const sameEdges = graph.edges.filter((e) => e.kind === "same_generation" && e.source.generation === gen);
    if (sameEdges.length > 0) {
      lines.push("■ 同世代の変換");
      for (const edge of sameEdges) {
        lines.push(`  - ${edge.source.label} →[${edge.label}]→ ${edge.target.label}${edge.text ? ` ／「${edge.text}」` : ""}`);
      }
    }

    if (nextGen !== undefined) {
      const crossEdges = graph.edges.filter(
        (e) => e.kind === "cross_generation" && e.source.generation === gen && e.target.generation === nextGen
      );
      if (crossEdges.length > 0) {
        lines.push(`■ 世代${gen}→${nextGen} の橋渡し`);
        for (const edge of crossEdges) {
          lines.push(`  - ${edge.source.label}（世代${gen}）→[${edge.label}]→ ${edge.target.label}（世代${nextGen}）${edge.text ? ` ／「${edge.text}」` : ""}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function buildMultiScenarioPrompt(graphs: StoryGraph[]): string {
  const graphTexts = graphs
    .map((g, i) => buildGraphText(g, `視点${i + 1}`))
    .join("\n\n");

  return [
    "あなたはAPモデルを物語化するための脚本設計者です。",
    `以下に${graphs.length}つのAPモデルがあります。それぞれ異なる人物・組織・社会の「視点」を表しています。`,
    "これらを並列の視点として扱い、互いに影響し合う一つの物語世界を設計してください。",
    "各視点の世代の順番は時系列を表します。矢印は左から右への影響・変化です。",
    "出力はJSONだけにしてください。",
    "",
    "JSON_SCHEMA:",
    JSON.stringify({
      mainTheme: "string（複数視点を貫くテーマ）",
      setting: { place: "string", time: "string", socialContext: "string" },
      perspectives: graphs.map((_, i) => ({
        index: i + 1,
        character: "string（この視点の主人公または主体）",
        role: "string（物語全体での役割）",
        keyChange: "string（この視点で起きる重要な変化）",
      })),
      plotBeats: [
        {
          order: "number",
          perspectiveIndex: "number（1〜N）",
          event: "string（出来事）",
          impact: "string（他の視点への影響）",
        },
      ],
    }),
    "",
    "AP_GRAPHS:",
    graphTexts,
  ].join("\n");
}

function buildMultiStoryPrompt(graphs: StoryGraph[], scenarioPlan: string): string {
  const graphTexts = graphs
    .map((g, i) => buildGraphText(g, `視点${i + 1}`))
    .join("\n\n");

  return [
    "あなたは短編小説の作家です。",
    `以下に${graphs.length}つのAPモデル（視点）とSCENARIO_PLANがあります。`,
    "各視点を並列に扱い、互いが影響し合う一つの物語として書いてください。",
    "視点が交差する場面、共鳴する変化、対比される価値観を織り込んでください。",
    "条件:",
    "- 4〜8段落",
    "- 各視点が少なくとも1回は登場すること",
    "- 抽象論だけでなく具体的な場面・行動が見えること",
    "- 見出しや箇条書きは付けず、本文のみ返すこと",
    "",
    "SCENARIO_PLAN:",
    scenarioPlan,
    "",
    "AP_GRAPHS:",
    graphTexts,
  ].join("\n");
}

function normalizeScenarioPlan(outputText?: string): string {
  const text = outputText?.trim();
  if (!text) return "{}";
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) {
    try { return JSON.stringify(JSON.parse(fenced[1]), null, 2); } catch { /* ignore */ }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.stringify(JSON.parse(text.slice(start, end + 1)), null, 2); } catch { /* ignore */ }
  }
  return JSON.stringify({ rawPlan: text }, null, 2);
}
