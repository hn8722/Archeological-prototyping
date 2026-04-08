export type TemplateNodeDefinition = {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
};

export type TemplateEdgeDefinition = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export const AP_TEMPLATE_NODES: TemplateNodeDefinition[] = [
  {
    id: "n1",
    label: "制度",
    x: 220,
    y: 50,
    color: "#166ecd",
  },
  {
    id: "n2",
    label: "日常の空間とユーザー体験",
    x: 70,
    y: 180,
    color: "#88e7ef",
  },
  {
    id: "n3",
    label: "前衛的社会問題",
    x: 220,
    y: 310,
    color: "#f7a38c",
  },
  {
    id: "n4",
    label: "社会問題",
    x: 430,
    y: 180,
    color: "#f4ea85",
  },
  {
    id: "n5",
    label: "技術や資源",
    x: 640,
    y: 50,
    color: "#b8e388",
  },
  {
    id: "n6",
    label: "人々の価値観",
    x: 640,
    y: 310,
    color: "#f3ce2a",
  },
];

export const AP_TEMPLATE_EDGES: TemplateEdgeDefinition[] = [
  { id: "e1", source: "n2", target: "n1", label: "ビジネスエコシステム" },
  { id: "e2", source: "n2", target: "n3", label: "アート" },
  { id: "e3", source: "n1", target: "n4", label: "メディア" },
  { id: "e4", source: "n3", target: "n4", label: "コミュニティ化" },
  { id: "e5", source: "n4", target: "n5", label: "組織化" },
  { id: "e6", source: "n4", target: "n6", label: "コミュニケーション" },
  { id: "e7", source: "n5", target: "n1", label: "パラダイム" },
  { id: "e8", source: "n6", target: "n3", label: "習慣化" },
  { id: "e9", source: "n1", target: "n5", label: "標準化" },
  { id: "e10", source: "n3", target: "n6", label: "文化芸術振興" },
  { id: "e11", source: "n5", target: "n2", label: "製品・サービス" },
  { id: "e12", source: "n6", target: "n2", label: "意味付け" },
];