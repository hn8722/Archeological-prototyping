export type FieldDef = {
  key: string;
  label: string;
};

export const MODEL_FIELDS: Record<string, FieldDef[]> = {
  "日常の空間とユーザー体験": [
    { key: "who", label: "誰が" },
    { key: "where", label: "どこで" },
    { key: "when", label: "いつ" },
    { key: "experience", label: "何の経験をするか" },
  ],
  "制度": [
    { key: "name", label: "名前" },
    { key: "content", label: "内容" },
  ],
  "前衛的社会問題": [
    { key: "name", label: "名前" },
    { key: "content", label: "内容" },
  ],
  "社会問題": [
    { key: "name", label: "名前" },
    { key: "content", label: "内容" },
  ],
  "人々の価値観": [
    { key: "who", label: "誰が" },
    { key: "aspiration", label: "どうありたいのか" },
  ],
  "技術や資源": [
    { key: "name", label: "名前" },
    { key: "content", label: "内容" },
  ],
  "組織化": [
    { key: "orgName", label: "組織名" },
    { key: "purpose", label: "組織の目的" },
  ],
  "コミュニケーション": [
    { key: "toolName", label: "コミュニケーションツール名" },
    { key: "reason", label: "使用する理由" },
  ],
  "製品・サービス": [
    { key: "productName", label: "製品/サービス名" },
    { key: "function", label: "機能" },
  ],
  "製品やサービス": [
    { key: "productName", label: "製品/サービス名" },
    { key: "function", label: "機能" },
  ],
  "意味付け": [
    { key: "productName", label: "製品/サービス名" },
    { key: "reason", label: "使用する理由" },
  ],
  "パラダイム": [
    { key: "techName", label: "技術名" },
    { key: "content", label: "内容" },
  ],
  "習慣化": [
    { key: "who", label: "誰が" },
    { key: "routine", label: "ルーティン内容" },
  ],
  "ビジネスエコシステム": [
    { key: "stakeholderName", label: "ステークホルダー名" },
    { key: "role", label: "エコシステム内での立場" },
  ],
  "アート": [
    { key: "who", label: "誰が" },
    { key: "claim", label: "主張内容" },
  ],
  "コミュニティ化": [
    { key: "communityName", label: "コミュニティ名" },
    { key: "content", label: "内容" },
  ],
  "メディア": [
    { key: "institutionName", label: "制度名" },
    { key: "content", label: "内容" },
  ],
  "標準化": [
    { key: "techName", label: "技術・資源名" },
    { key: "content", label: "内容" },
  ],
  "文化芸術振興": [
    { key: "name", label: "名前" },
    { key: "eventContent", label: "イベント・展示の内容" },
  ],
};

export function getFieldDefs(label: string): FieldDef[] {
  return MODEL_FIELDS[label] ?? [];
}

export function combineFields(label: string, fields: Record<string, string>): string {
  const defs = getFieldDefs(label);
  return defs
    .map((def) => fields[def.key]?.trim() ?? "")
    .filter(Boolean)
    .join(" / ");
}

export function areAllFieldsFilled(label: string, fields: Record<string, string>): boolean {
  const defs = getFieldDefs(label);
  if (defs.length === 0) return false;
  return defs.every((def) => Boolean(fields[def.key]?.trim()));
}
