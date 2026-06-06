import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import { AP_CROSS_GENERATION_EDGES, AP_TEMPLATE_EDGES, AP_TEMPLATE_NODES } from "@/lib/templates/apTemplate";
import { FieldDef } from "@/lib/templates/fieldSchema";
import { MODEL_DESCRIPTIONS } from "@/lib/templates/modelDescriptions";
import { getUser } from "@/lib/auth/actions";
import { canUseSessionAi, WORKSHOP_PARTICIPANT_COOKIE } from "@/lib/server/session-store";

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

const AP_STRUCTURE_EXPLANATION = `
You are an expert in Archeological Prototyping (AP), 
trained to analyze social change processes inductively.
Your task is to fill in the following model fields 
based on the session context provided.

【Overview】
Archaeological Prototyping (AP) is a sociocultural model consisting of 18 items (6
objects and 12 arrows). In short, it is a model that divides society and culture
into 18 elements and logically describes the connections between them. It uses
category theory, where objects represent sets and arrows represent functions
between sets that transform objects.
【Rules】
The rules for this model are described below.
・A sociocultural model of one generation is composed of six objects and
twelve arrows.
・A generation can be extended to any number of generations in either the past or the future.
・The unit of time for a generation is arbitrary.
・The object that marks the start of a generation can be any object.
・The object is converted to another object by an arrow (an individual element
x1 in an object (set) X is converted to an individual element y1 in an object Y
by a mapping f).
・The data contained in a single object is a collection of data converted from
two different objects (the object Y contains individual elements xn converted
from the object X via the mapping f, and individual elements converted from
the object Z via the mapping g).
・Individual data x1 contained in the object (X), the transformation function
g1, and data y1 in another object (Y) can be identified as related in the
database.
・When all related objects and arrows are connected, they form the plot of a
story.
・The plot of the story does not need to include all objects and arrows. Create
the plot using the existing data. Missing objects and arrows can be estimated.
・There is no temporal difference between objects converted with solid
arrows. On the other hand, there is a temporal difference (conversion from
past to future) between objects converted with dotted arrows.


【Definitions of each element】
[
{
"name":"Emerging social issues",
"type":"object",
"definition":"Social issues that are brought to light through art (social criticism)
in relation to the social problems caused by technological and
resource paradigms, the physical spaces where daily life is lived,
and the experiences of users in those spaces. These issues are not
recognised by everyone, but only by a certain group of
advanced/minority people. Specifically, they include macro
environmental issues (climate, ecology, etc.) and human
environmental issues (ethics, economics, hygiene, etc.).",
"influences_from":["Physical spaces and user experiences", "art(social criticism)","Technology and resources", "technology paradigm"],
"influences_to":["People's values","promotion of culture and the arts","Social issues","community formation"]
},
{
"name":"People's values",
"type":"object",
"definition":"The ideal state of people who empathise with social issues that
cannot be addressed by systems that are promoted through the
promotion of culture and the arts, or through everyday
communication.",
"influences_from":["Social issues", "communication","Emerging social issues", "promotion of culture and the arts"],
"influences_to":["Social systems","customs","Physical spaces and user experience","sensemaking"]
},
{
"name":"Social issues",
"type":"object",
"definition":"Social issues recognised by society through advanced communities
tackling emergent social issues, or social issues exposed through
the media and constrained by systems. These issues become
apparent as an object for resolution within society.",
"influences_from":["Social systems", "media","Emerging social issues", "community formation"],
"influences_to":["Technology and Resource","organization","People's values","communication"]
},
{
"name":"Technology and Resource",
"type":"object",
"definition":"Technology and resources that are standardized and constrained
from the past in institutions created to facilitate the smooth
functioning of the routines of daily life, and that are owned by
organizations (including for-profit and non-profit corporations and
unincorporated groups, whether new or existing) that are
organized to solve social problems.",
"influences_from":["Social issues", "organization","Social systems", "standardization"],
"influences_to":["Emergent social issues","technology paradigm","Physical spaces and user experience","product and service"]
},
{
"name":"Physical space and user experience",
"type":"object",
"definition":"A physical space are made up of products and services developed
through the mobilization of technology and resources, and the
experiences of users who assign meanings to products and
services in that space under certain values and use them. The
relationship between values and user experience is such that, for
example, people with the value "I want to become an AI engineer"
assign a meaning to a PC as "something for learning programming"
and experience "programming.",
"influences_from":["People's values", "sensemaking","Social systems", "customs"],
"influences_to":["Social systems","business ecosystems","Emergent social issues","art(social criticism)"]
},
{
"name":"Social systems",
"type":"object",
"definition":"Institutions that are created to better facilitate the daily practices
of people with certain values and the parties involved in
conducting business (business ecosystem) that make up the
physical space and user experience. Specifically, these include
laws, guidelines, industry standards, administrative guidance, and
morals.",
"influences_from":["People's values", "customs","Physical spaces and user experience", "business ecosystems"],
"influences_to":["Social issues","media","Technology and resources","standardization"]
},
{
"name":"media",
"type":"arrow",
"definition":"Media that reveal the institutional deficiencies of
our time. In addition to major media such as mass
media and online media, it also includes
individuals who disseminate information.
Transforms institutions into social problems."
},
{
"name":"community formation",
"type":"arrow",
"definition":"A community of people who recognize emergent
social issues. It can be formal or informal.
Transforms emergent social issues into social
issues."
},
{
"name":"promotion of Culture and the Arts",
"type":"arrow",
"definition":"Activities to exhibit social issues made manifest
by art (social criticism) as works of art and
communicate them to people. Converting
emergent social issues into people's sense of
values."
},
{
"name":"standardization",
"type":"arrow",
"definition":"Social systems that are standardized to affect a
wider range of stakeholders. Convert social
systems into technologies and resources."
},
{
"name":"communication",
"type":"arrow",
"definition":"A means of communication to communicate social
issues to a wider audience. For example, in recent
years, this is often done through social
networking sites. Translate social issues into
people's values."
},
{
"name":"organization",
"type":"arrow",
"definition":"Organizations formed to solve social problems.
Any organization, whether incorporated or
unincorporated, old or new, that addresses a new
social problem that is widely recognized in
society. Convert social problems into technologies
and resources."
},
{
"name":"sensemaking",
"type":"arrow",
"definition":"Why people use products and services based on
their values. Translate people's values into
physical spaces and user experiences."
},
{
"name":"product and service",
"type":"arrow",
"definition":"Products and services created using the
organization's own technology and resources.
Transform technology and resources into physical
spaces and user experiences."
},
{
"name":"custom",
"type":"arrow",
"definition":"Daily actions that people perform based on
values, which are performed as habits. The
conversion of values into institutions."
},
{
"name":"technology paradigm",
"type":"arrow",
"definition":"As the dominant technology or resource of the time, one that will have an impact on the next
generation. Convert the technology or resource
into an emergent social issue."
},
{
"name":"business ecosystem",
"type":"arrow",
"definition":"A network formed by the parties involved in the
products and services that make up the physical
space and user experience in order to maintain it.
Transforms physical spaces and user experiences
into institutions."
},
{
"name":"Art (social criticism)",
"type":"arrow",
"definition":"Beliefs of people who see problems that people
are unaware of from a subjective/intrinsic
perspective. Has a role in presenting problems
that are uncomfortable with physical space and
user experience. Transforms physical spaces and
user experiences into avant-garde problems."
},
]

`;

const FEW_SHOT_CASES = [
  {
    target: "コミュニティ化",
    related: ["前衛的社会問題"],
    text: [
      "例: 「前衛的社会問題」に「Extinction Rebellionが、石油依存経済が生態系を破壊するという問題を提起している」とある場合、",
      "→ communityName: \"Extinction Rebellion に共感する若者・研究者・市民活動家のローカルグループ\"",
      "→ content: \"月1回の街頭デモと週次のオンライン勉強会を通じて、気候危機を自分事として捉えるコミュニティを形成している\"",
    ].join("\n"),
  },
  {
    target: "組織化",
    related: ["社会の目標"],
    text: [
      "例: 「社会の目標」に「高齢者の孤独死が都市部で発生し、行政の把握が困難な状況にある」とある場合、",
      "→ orgName: \"NPO法人つながり訪問隊と地域の見守りサービス事業者\"",
      "→ purpose: \"定期訪問とセンサー通知を組み合わせ、高齢者の孤立を早期に発見して支援につなげる\"",
    ].join("\n"),
  },
  {
    target: "前衛的社会問題",
    related: ["アート"],
    text: [
      "例: 「アート」に「アーティストが難民の救命胴衣を展示し、移民政策への無関心を批判している」とある場合、",
      "→ category: \"人文環境問題\"",
      "→ subCategory: \"倫理\"",
      "→ content: \"欧州の移民受け入れ制度が書類審査を優先し、海難事故や収容施設での人権侵害を見落としている問題\"",
    ].join("\n"),
  },
];

function buildLocalApGuidance(targetLabel: string) {
  const allEdges = [...AP_TEMPLATE_EDGES, ...AP_CROSS_GENERATION_EDGES];
  const targetNode = AP_TEMPLATE_NODES.find((node) => node.label === targetLabel);
  const targetEdge = allEdges.find((edge) => edge.label === targetLabel);

  const lines = [
    "あなたはArcheological Prototyping（AP）の入力補助者です。",
    "今回の補助ではAP全体を完成させるのではなく、対象要素と直接つながる1-hopの関係だけを使います。",
    "未提示の遠い要素や、AP全体構造からの飛躍した因果は推測しないでください。",
  ];

  if (targetNode) {
    const localEdges = allEdges.filter((edge) => edge.source === targetNode.id || edge.target === targetNode.id);
    const relatedNodeIds = new Set(
      localEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== targetNode.id)
    );
    const relatedNodes = AP_TEMPLATE_NODES.filter((node) => relatedNodeIds.has(node.id));

    lines.push(`\n【対象要素の説明】\n${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "APモデルの構成要素。"}`);

    if (localEdges.length > 0) {
      lines.push(
        "\n【直接つながる関係だけ】",
        ...localEdges.map((edge) => {
          const source = AP_TEMPLATE_NODES.find((node) => node.id === edge.source)?.label ?? edge.source;
          const target = AP_TEMPLATE_NODES.find((node) => node.id === edge.target)?.label ?? edge.target;
          const edgeDefinition = MODEL_DESCRIPTIONS[edge.label] ?? "対象間を変換する関係。";
          return `- ${source} --${edge.label}--> ${target}: ${edgeDefinition}`;
        })
      );
    }

    if (relatedNodes.length > 0) {
      lines.push(
        "\n【直接つながる要素の説明】",
        ...relatedNodes.map((node) => `- ${node.label}: ${MODEL_DESCRIPTIONS[node.label] ?? "APモデルの構成要素。"}`)
      );
    }
  } else if (targetEdge) {
    const source = AP_TEMPLATE_NODES.find((node) => node.id === targetEdge.source)?.label ?? targetEdge.source;
    const target = AP_TEMPLATE_NODES.find((node) => node.id === targetEdge.target)?.label ?? targetEdge.target;

    lines.push(
      `\n【対象要素の説明】\n${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "APモデルの構成要素間を変換する関係。"}`,
      "\n【直接つながる関係だけ】",
      `- ${source} --${targetLabel}--> ${target}`,
      "\n【直接つながる要素の説明】",
      `- ${source}: ${MODEL_DESCRIPTIONS[source] ?? "APモデルの構成要素。"}`,
      `- ${target}: ${MODEL_DESCRIPTIONS[target] ?? "APモデルの構成要素。"}`
    );
  } else {
    lines.push(`\n【対象要素の説明】\n${targetLabel}: ${MODEL_DESCRIPTIONS[targetLabel] ?? "APモデルの構成要素。"}`);
  }

  return lines.join("\n");
}

function buildRelevantExamples(targetLabel: string, contextLabels: string[]) {
  const contextLabelSet = new Set(contextLabels);
  const examples = FEW_SHOT_CASES.filter(
    (item) => item.target === targetLabel || item.related.some((label) => contextLabelSet.has(label))
  );

  if (examples.length === 0) return "";

  return ["\n【参考例（関連するもののみ）】", ...examples.slice(0, 2).map((item) => item.text)].join("\n\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.label) {
      return NextResponse.json({ error: "対象ラベルが必要です。" }, { status: 400 });
    }

    const user = await getUser();
    const participantToken = (await cookies()).get(WORKSHOP_PARTICIPANT_COOKIE)?.value;
    if (!body.sessionId) {
      return NextResponse.json({ error: "セッション情報が必要です。" }, { status: 401 });
    }
    const aiAccess = await canUseSessionAi(body.sessionId, user?.id, user?.email, participantToken);
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: "このセッションではAI利用が停止されています。" }, { status: 403 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    // 入力済みのセッション全体の文脈を構築
    const filledNodes = (body.sessionNodes ?? [])
      .filter((n) => n.text?.trim())
      .map((n) => `[${n.label}]: ${n.text}`)
      .join("\n");

    const filledEdges = (body.sessionEdges ?? [])
      .filter((e) => e.text?.trim())
      .map((e) => `[${e.label}]: ${e.text}`)
      .join("\n");

    const sessionContext =
      filledNodes || filledEdges
        ? `\n【現在のセッションで入力済みの内容】\n${filledNodes}\n${filledEdges}`.trim()
        : "";

    // 現在のフィールド入力状況
    const currentFieldsText = body.fieldDefs
      ?.map((def) => {
        const val = body.currentFields?.[def.key]?.trim();
        return `  ${def.label}: ${val || "未入力"}`;
      })
      .join("\n") ?? "";

    // フィールドのJSONスキーマをプロンプトに渡す
    const fieldSchema = body.fieldDefs
      ?.map((def) => `"${def.key}": "${def.label}に入る内容"`)
      .join(",\n  ") ?? "";

    const contextLabels = [
      ...(body.sessionNodes ?? []).map((item) => item.label),
      ...(body.sessionEdges ?? []).map((item) => item.label),
    ];
    const localApGuidance = buildLocalApGuidance(body.label);
    const relevantExamples = buildRelevantExamples(body.label, contextLabels);

    const prompt = [
      localApGuidance,
      relevantExamples,
      sessionContext,
      `\n【今回埋めるモデル】`,
      `対象: ${body.label}`,
      `説明: ${body.description ?? "なし"}`,
      `\n【現在の入力状況】`,
      currentFieldsText || "  すべて未入力",
      `\n【指示】`,
      `上記の1-hop文脈と対象要素の説明だけを根拠に、「${body.label}」の各フィールドを埋めてください。`,
      `直接渡されていない遠いAP要素や、未入力の関係性を補って断定しないでください。`,
      `抽象的な説明ではなく、参加者が確認・修正できる程度に具体的な主体・行動・場面を含めてください。`,
      `ただし、文脈にない固有名詞、数値、実在組織名は無理に作らず、必要なら一般名詞で具体化してください。`,
      `他の入力済み項目と矛盾しない範囲に留めてください。`,
      `\n以下のJSONフォーマットのみを返してください（前置きや説明は不要）：`,
      `{`,
      `  ${fieldSchema}`,
      `}`,
    ].join("\n");

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "AIアシスト結果を取得できませんでした。" }, { status: 502 });
    }

    // JSONを抽出してパース
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
