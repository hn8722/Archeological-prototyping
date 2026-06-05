export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  dependsOn?: string;
  optionsByValue?: Record<string, string[]>;
  chips?: string[];
};

export const MODEL_FIELDS: Record<string, FieldDef[]> = {
  "日常の空間とユーザー体験": [
    { key: "when", label: "いつ" },
    { key: "who", label: "誰が" },
    { key: "where", label: "どこで" },
    { key: "experience", label: "どんな経験をするか" },
  ],
  制度: [
    {
      key: "category",
      label: "大分類",
      chips: ["形式的", "非形式"],
    },
    {
      key: "subCategory",
      label: "小分類",
      dependsOn: "category",
      optionsByValue: {
        形式的: ["法律", "ガイドライン", "業界標準", "行政指導"],
        非形式: ["モラル", "社会規範", "道徳", "倫理", "文化的慣習"],
      },
    },
    { key: "content", label: "内容", placeholder: "例: 業界団体が定めた安全基準が、製品設計や運用の前提になっている" },
  ],
  前衛的社会問題: [
    {
      key: "category",
      label: "大分類",
      chips: ["マクロ", "人文・環境問題"],
    },
    {
      key: "subCategory",
      label: "小分類",
      dependsOn: "category",
      optionsByValue: {
        マクロ: ["気候", "生態", "人口統計的"],
        "人文・環境問題": ["倫理", "経済", "衛生"],
      },
    },
    { key: "content", label: "内容", placeholder: "例: 気候変動により、都市部の熱中症リスクが特定の地域や高齢者に偏って現れている" },
  ],
  社会の目標: [
    {
      key: "statement",
      label: "社会はどうあるべきか",
      placeholder: "例: 社会は、誰もが孤立せず必要な支援につながれる状態であるべきだ",
    },
  ],
  ペルソナ: [
    { key: "demographic", label: "デモグラフィック", placeholder: "例: 30代女性、単身世帯、郊外在住" },
    { key: "sociographic", label: "ソシオグラフィック", placeholder: "例: 介護と仕事を両立する地域病院の看護師" },
    { key: "personaTagline", label: "ペルソナを端的に表現する一言", placeholder: "例: 誰かに頼りすぎず地域とつながりたい人" },
    { key: "goal", label: "ゴール", placeholder: "例: 家族や行政に過度に頼らず、安心して日常の移動と交流を続けたい" },
  ],
  技術や資源: [
    { key: "name", label: "名前" },
    { key: "content", label: "内容" },
  ],
  組織化: [
    { key: "orgName", label: "組織名" },
    { key: "purpose", label: "組織の目的" },
  ],
  コミュニケーション: [
    {
      key: "category",
      label: "カテゴリ",
      chips: ["SNS", "マスメディア", "口コミ"],
    },
    { key: "toolName", label: "コミュニケーションツール名" },
    { key: "reason", label: "使用する理由" },
  ],
  "製品・サービス": [
    { key: "productName", label: "製品/サービス名" },
    { key: "function", label: "機能" },
  ],
  意味付け: [
    { key: "productName", label: "製品/サービス名" },
    { key: "reason", label: "使用する理由" },
  ],
  パラダイム: [
    { key: "techName", label: "技術名" },
    { key: "content", label: "共有されている考え" },
  ],
  習慣化: [
    { key: "who", label: "誰が" },
    { key: "routine", label: "具体的な行動やルーティン詳細" },
  ],
  ビジネスエコシステム: [
    {
      key: "category",
      label: "カテゴリ",
      chips: ["企業", "行政", "団体", "個人"],
    },
    { key: "stakeholderName", label: "ステークホルダー名" },
    { key: "role", label: "エコシステム内での立場" },
  ],
  アート: [
    { key: "who", label: "誰が" },
    { key: "claim", label: "主張内容" },
  ],
  コミュニティ化: [
    { key: "communityName", label: "コミュニティ名" },
    { key: "content", label: "具体的な運動の詳細" },
  ],
  メディア: [
    { key: "institutionName", label: "メディア" },
    { key: "content", label: "報道内容" },
  ],
  標準化: [
    {
      key: "category",
      label: "カテゴリ",
      chips: ["ISO", "規格", "政策的な業界標準", "資格認定制度"],
    },
    { key: "techName", label: "名称" },
    { key: "content", label: "内容" },
  ],
  文化芸術振興: [
    {
      key: "category",
      label: "カテゴリ",
      chips: ["映画", "テレビ", "小説", "アニメ", "漫画", "博覧会", "美術館", "演劇", "音楽"],
    },
    { key: "name", label: "名前" },
    { key: "eventContent", label: "イベント・展示の内容" },
  ],
};

export function getFieldDefs(label: string): FieldDef[] {
  return MODEL_FIELDS[label] ?? [];
}

const SENTENCE_TEMPLATES: Record<string, (f: Record<string, string>) => string> = {
  "日常の空間とユーザー体験": (f) =>
    `${f.who ?? ""}が${f.where ?? ""}で${f.when ?? ""}に${f.experience ?? ""}という経験をしている`,
  制度: (f) =>
    `${f.category ?? ""}制度のうち${f.subCategory ?? ""}として、${f.content ?? ""}`,
  前衛的社会問題: (f) =>
    `${f.category ?? ""}の${f.subCategory ?? ""}に関する前衛的社会問題として、${f.content ?? ""}`,
  社会の目標: (f) => `${f.statement ?? ""}`,
  ペルソナ: (f) =>
    `${f.demographic ?? ""} / ${f.sociographic ?? ""}。「${f.personaTagline ?? ""}」という価値観を持ち、${f.goal ?? ""}ことを目指している`,
  アート: (f) =>
    `${f.who ?? ""}が「${f.claim ?? ""}」という問題提起をしている`,
  習慣化: (f) =>
    `${f.who ?? ""}が${f.routine ?? ""}を日常的なルーティンとして行っている`,
  組織化: (f) =>
    `「${f.orgName ?? ""}」が${f.purpose ?? ""}を目的として組織化されている`,
  コミュニケーション: (f) =>
    `${f.category ?? ""}として${f.toolName ?? ""}を${f.reason ?? ""}という理由で活用している`,
  "製品・サービス": (f) =>
    `「${f.productName ?? ""}」は${f.function ?? ""}という機能を持つ製品・サービスである`,
  意味付け: (f) =>
    `「${f.productName ?? ""}」は${f.reason ?? ""}という意味で使われている`,
  ビジネスエコシステム: (f) =>
    `${f.category ?? ""}である「${f.stakeholderName ?? ""}」が${f.role ?? ""}という立場でエコシステムに関わっている`,
  コミュニティ化: (f) =>
    `「${f.communityName ?? ""}」というコミュニティが形成されており、${f.content ?? ""}`,
  標準化: (f) =>
    `${f.category ?? ""}として「${f.techName ?? ""}」が標準化されており、${f.content ?? ""}`,
  文化芸術振興: (f) =>
    `${f.category ?? ""}「${f.name ?? ""}」において${f.eventContent ?? ""}が展示・上演されている`,
  技術や資源: (f) =>
    `「${f.name ?? ""}」は${f.content ?? ""}という技術や資源である`,
  メディア: (f) =>
    `${f.institutionName ?? ""}が${f.content ?? ""}を報道・発信している`,
  パラダイム: (f) =>
    `${f.techName ?? ""}について、${f.content ?? ""}という考えが共有されている`,
};

function toSentence(label: string, fields: Record<string, string>): string {
  const template = SENTENCE_TEMPLATES[label];
  if (template) return template(fields);

  const defs = getFieldDefs(label);
  return defs
    .map((def) => fields[def.key]?.trim() ?? "")
    .filter(Boolean)
    .join(" / ");
}

export function combineFields(label: string, fields: Record<string, string>): string {
  const defs = getFieldDefs(label);
  if (defs.length === 0) return "";
  return toSentence(label, fields);
}

export function areAllFieldsFilled(label: string, fields: Record<string, string>): boolean {
  const defs = getFieldDefs(label);
  if (defs.length === 0) return false;
  return defs.every((def) => Boolean(fields[def.key]?.trim()));
}

export function combineFieldEntries(label: string, fieldEntries: Record<string, string>[]): string {
  const defs = getFieldDefs(label);
  if (defs.length === 0) return "";
  return fieldEntries
    .map((entry) => toSentence(label, entry))
    .filter(Boolean)
    .join("\n");
}

export function hasAnyCompletedEntry(label: string, fieldEntries: Record<string, string>[]): boolean {
  const defs = getFieldDefs(label);
  if (defs.length === 0) return false;
  return fieldEntries.some((entry) => defs.every((def) => Boolean(entry[def.key]?.trim())));
}
