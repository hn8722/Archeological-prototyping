"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { FieldEntry, NodeEntry, EdgeEntry } from "@/lib/types/ap";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { getFieldDefs, areAllFieldsFilled } from "@/lib/templates/fieldSchema";

type InputMode = "text" | "image" | "video";

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M3 5h18v2H3V5zm0 4h18v2H3V9zm0 4h12v2H3v-2z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H3V5h18v14zm-8-7l-3 3.72L8 13l-4 5h16l-5-6z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M10 15l5.19-3L10 9v6zm11-8v10c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2z" />
    </svg>
  );
}

type RelatedItem = {
  kind: "node" | "edge";
  label: string;
  text: string | null;
};

const UX_YEAR_OPTIONS = Array.from({ length: 201 }, (_, index) => 1900 + index);

function getYearFromValue(value: string) {
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1900 && year <= 2100 ? year : null;
}

function YearPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedYear = getYearFromValue(value);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedButtonRef.current?.scrollIntoView({ block: "center" });
  }, [selectedYear]);

  return (
    <div className="year-picker" role="listbox" aria-label="年を選択">
      <div className="year-picker-highlight" aria-hidden="true" />
      <div className="year-picker-spacer" aria-hidden="true" />
      {UX_YEAR_OPTIONS.map((year) => {
        const isSelected = selectedYear === year;
        return (
          <button
            key={year}
            ref={isSelected ? selectedButtonRef : null}
            type="button"
            className={`year-picker-option ${isSelected ? "year-picker-option-selected" : ""}`}
            onClick={() => onChange(`${year}年`)}
            aria-selected={isSelected}
            role="option"
          >
            {year}年
          </button>
        );
      })}
      <div className="year-picker-spacer" aria-hidden="true" />
    </div>
  );
}

const MODEL_DESCRIPTIONS_V1: Record<string, string> = {
  制度:"ある価値観を持った人々が日常的に行う習慣をより円滑に行うために作られる制度や、日常の空間とユーザー体験を構成するビジネスを行う関係者(ビジネスエコシステム)がビジネスをより円滑に行うために作られる制度",
  日常の空間とユーザー体験:"技術や資源を動員して開発された製品・サービスによって構成される物理的空間であり、その空間で製品・サービスに対してある価値観のもとで意味付けを行い、それらを使用するユーザーの体験",
  前衛的社会問題:"技術や資源のパラダイムによって引き起こされる社会問題や日常生活が営まれる空間やそこでのユーザーの体験に対してアート(社会批評)を介して顕在化される社会問題.この問題は誰もが認識しているのではなく、ある一部の先進的/マイノリティの人々のみが認識するもの",
  社会の目標: "前衛的社会問題に取り組み先進的なコミュニティによって社会に認識される社会問題やメディアを介して暴露される制度で拘束された社会問題.社会において解決すべき対象として顕在化される",
  技術や資源: "日常生活のルーティンを円滑に機能させるために作られた制度のうち、標準化されて過去から制約を受ける技術や資源であり、社会問題を解決すべく組織化された組織(営利・非営利法人、法人格を持たない集団も含み、新規・既存を問わない)が持つ技術や資源",
  人々の価値観:"文化芸術振興を通して広められる前衛的社会問題や日常のコミュニケーションによって広められる制度で対応できない社会問題に共感する人々のありたい姿",
  ビジネスエコシステム:"日常の空間やユーザー体験を維持するために、それを構成する製品・サービスに関わる関係者が形成するネットワーク",
  アート: "人々が気付かない問題を、主観的/内発的な視点で見る人の信念.日常の空間とユーザー体験に違和感を持ち、問題を提示する役割を持つ",
  メディア: "現代の制度的欠陥を顕在化させるメディア.マスメディアやネットメディア等の主要なメディアに加え、情報発信を行う個人も含まれる",
  コミュニティ化: "前衛的な問題を認識する人々が集まってできるコミュニティ.公式か非公式かは問わない",
  組織化: "社会問題を解決するために形成される組織.法人格の有無や新旧の組織を問わず、社会で広く認識された新しい社会問題に取り組む全ての組織",
  コミュニケーション: "社会問題をより多くの人々に伝えるためのコミュニケーション手段",
  文化芸術振興:"アート(社会批評)が顕在化させた社会問題を作品として展示し、人々に伝える活動",
  標準化:"制度の中でも、より広い関係者に影響を与えるために標準化された制度",
  意味付け:"人々の価値観に基づいて製品やサービスを使用する理由",
  "製品・サービス":"組織が保有する技術や資源を利用して創造する製品やサービス",
  製品やサービス:"組織が保有する技術や資源を利用して創造する製品やサービス",
  習慣化:"人々が価値観に基づいて行う日々の活動のうち、習慣として行われるもの",
  パラダイム:"その時代の支配的な技術や資源として、次世代にも影響をもたらすもの",
};

const MODEL_DESCRIPTIONS_V2: Record<string, string> = {
  ...MODEL_DESCRIPTIONS_V1,
  制度:"ビジネスを円滑に回すため、また人々の習慣を支えるための制度 ",
  日常の空間とユーザー体験:"様々な製品やサービスによって構成される空間.ユーザーはこの空間の中で特定の体験を行う",
  前衛的社会問題:"社会にとって重要だが、まだ多くの人が気づいていない社会問題 ",
  社会の目標: "顕在化された社会問題に対してマジョリティが認識する社会が向かうべき目標",
  技術や資源: "社会の目標を達成するために利用可能な技術や資源 ",
  人々の価値観:"人々がどうありたいか ",
  ビジネスエコシステム:"日常の空間やユーザー体験を維持するために、それを構成する製品・サービスに関わる関係者が形成するネットワーク.複数の企業・組織・個人（場合によってはユーザーも含む）が相互に依存・連携しながら、価値を共創し、進化していくビジネスの仕組み",
  アート: "現代社会で起こる現象を批評し、社会に揺らぎを与え、均衡を崩す存在。芸術家や批評家、フーチャリスト、研究者等、日常の中で人々が気づかない問題や当たり前を捉え直す",
  メディア: "制度的な欠点を大衆に報道するメディア",
  コミュニティ化: "前衛的社会問題に気付き、社会に顕在化させようと運動する人々の集まり",
  組織化: "顕在化された解決すべき目標を達成するために生み出された組織.スタートアップをはじめとする企業や、団体が設立される",
  コミュニケーション: "社会で解決すべきと設定された目標を広く普及させるための手段",
  文化芸術振興:"芸術や文化活動を支援し、その創造・継承・発信を通じて、人々の感性を豊かにし、社会や地域の活力を高める取り組み",
  標準化:"制度の中でも公式に標準化され、広く社会に支配的となったもの",
  意味付け:"人々の価値観に基づいて製品やサービスを使用する理由",
  製品やサービス:"人々が製品・サービスを利用する理由",
  習慣化:"ある特定の価値観を持った人々が行う慣習的な行動・ルーティン",
  パラダイム:"「技術とは何ができ、どのように作られ、どう使われるべきか」という点について人々が共有している当たり前の考え方や前提.新しい技術的パラダイムが現れると、単に性能が向上するだけでなく、設計の考え方、産業構造、私たちの行動や価値観そのものが変わる",
};
const MODEL_DESCRIPTIONS = MODEL_DESCRIPTIONS_V2;

const MODEL_HINTS: Record<string, string> = {
  "技術や資源": "既に存在する技術・資金・人材・データ・組織基盤のうち、このモデルを支えている具体例を挙げると書きやすくなります。",
  制度: "制度やルールとして定着しているものに注目し、法律・慣行・業界標準・運用ルールなどを具体例で書くと整理しやすくなります。",
  "日常の空間とユーザー体験": "人が日常の中で実際に触れている場面を思い浮かべ、行動・感情・使い勝手・体験の流れを具体的に書くとまとまりやすくなります。",
  "前衛的社会問題": "まだ主流ではないが先鋭的に現れている問題や兆候に注目し、誰に何が起き始めているのかを書くと見えやすくなります。",
  社会の目標: "すでに社会で共有されている課題や、社会が向かうべき目標として何が認識されているのかを書くと整理しやすくなります。",
  "人々の価値観": "人々が何を大切だと感じるのか、どんな期待や不安を持つのかに注目し、言葉や態度の変化として書くと捉えやすくなります。",
  ビジネスエコシステム: "企業・自治体・利用者など複数の主体がどう関わっているかを考え、役割分担や利益の流れを書くと見通しが良くなります。",
  アート: "表現や感性の面からどんな新しい見方を提示しているかに注目し、象徴的な作品や実践を書くと具体化しやすくなります。",
  メディア: "どの媒体や発信の仕組みを通じて広がっているかを考え、伝わり方や話題化のされ方を書くと整理しやすくなります。",
  コミュニティ化: "同じ関心を持つ人がどう集まり、支え合い、活動しているかを具体的な場やつながりとして書くと見えやすくなります。",
  組織化: "活動や課題がどのように役割分担され、組織として形になっているかに注目し、主体や仕組みを書くと整理しやすくなります。",
  コミュニケーション: "人と人のあいだで何が共有され、どう理解や行動が変わるのかに注目し、会話・発信・参加の形を書いてみてください。",
  標準化: "ルールや仕様が共通化されている点に注目し、どこまで合意されているのか、何が基準になっているのかを書くと整理しやすくなります。",
  文化芸術振興: "文化や芸術を支える仕組み・活動・支援制度に注目し、誰が何を後押ししているのかを具体的に書くと見えやすくなります。",
  パラダイム: "前の世代から次の世代へ、物事の見方がどう切り替わったのかに注目し、価値基準の変化として書くと整理しやすくなります。",
  "製品・サービス": "技術や資源がどのような製品やサービスとして形になったのかを考え、利用場面や提供価値まで書くと具体化しやすくなります。",
  意味付け: "人々の価値観が次の世代でどんな意味として受け取られるのかに注目し、言葉・物語・解釈の変化として書いてみてください。",
  習慣化: "一時的な動きではなく、繰り返されて定着した行動や運用に注目し、日常や制度の中にどう埋め込まれたかを書くと見えやすくなります。",
};

function getNormalizedText(text: string | null) {
  const normalized = text?.trim();
  return normalized || null;
}

function dedupeRelatedItems(items: RelatedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getFilledRelatedItems(items: RelatedItem[]) {
  return items.filter((item) => Boolean(getNormalizedText(item.text)));
}

export function RightPanel() {
  const session = useSessionStore((state) => state.session);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const setNodeFieldEntries = useSessionStore((state) => state.setNodeFieldEntries);
  const setEdgeFieldEntries = useSessionStore((state) => state.setEdgeFieldEntries);
  const updateEdgeText = useSessionStore((state) => state.updateEdgeText);

  const selectedEntry = useMemo((): NodeEntry | EdgeEntry | null => {
    if (!session || !selectedTarget) return null;
    const generation = session.generations.find(
      (g) => g.generationIndex === selectedTarget.generation
    );
    if (!generation) return null;
    if (selectedTarget.kind === "node") return generation.nodes[selectedTarget.id] ?? null;
    return generation.edges[selectedTarget.id] ?? null;
  }, [session, selectedTarget]);

  const relatedModels = useMemo(() => {
    const empty = {
      affectedNodes: [] as RelatedItem[],
      affectedEdges: [] as RelatedItem[],
      affectingNodes: [] as RelatedItem[],
      affectingEdges: [] as RelatedItem[],
    };
    if (!session || !selectedTarget) return empty;

    const generation = session.generations.find(
      (item) => item.generationIndex === selectedTarget.generation
    );
    if (!generation) return empty;

    const edges = Object.values(generation.edges);
    const nodes = generation.nodes;
    const previousGeneration = session.generations.find(
      (item) => item.generationIndex === selectedTarget.generation - 1
    );
    const crossGenerationEdgeIds = new Set(AP_CROSS_GENERATION_EDGES.map((edge) => edge.id));

    if (selectedTarget.kind === "node") {
      const incomingCurrent = edges.filter(
        (edge) => edge.target === selectedTarget.id && !crossGenerationEdgeIds.has(edge.templateId)
      );
      const outgoingCurrent = edges.filter((edge) => edge.source === selectedTarget.id);
      const incomingPrevious =
        previousGeneration && selectedTarget.generation > 1
          ? Object.values(previousGeneration.edges).filter(
              (edge) => crossGenerationEdgeIds.has(edge.templateId) && edge.target === selectedTarget.id
            )
          : [];
      const nextGeneration = session.generations.find(
        (item) => item.generationIndex === selectedTarget.generation + 1
      );

      return {
        affectedNodes: dedupeRelatedItems(
          incomingCurrent
            .map((edge) => {
              const node = nodes[edge.source];
              return node ? { kind: "node" as const, label: node.label, text: getNormalizedText(node.text) } : null;
            })
            .concat(
              incomingPrevious.map((edge) => {
                const node = previousGeneration?.nodes[edge.source];
                return node ? { kind: "node" as const, label: node.label, text: getNormalizedText(node.text) } : null;
              })
            )
            .filter(Boolean) as RelatedItem[]
        ),
        affectedEdges: dedupeRelatedItems(
          incomingCurrent
            .map((edge) => ({ kind: "edge" as const, label: edge.label, text: getNormalizedText(edge.text) }))
            .concat(incomingPrevious.map((edge) => ({ kind: "edge" as const, label: edge.label, text: getNormalizedText(edge.text) })))
        ),
        affectingNodes: dedupeRelatedItems(
          outgoingCurrent
            .map((edge) => {
              const node = crossGenerationEdgeIds.has(edge.templateId)
                ? nextGeneration?.nodes[edge.target]
                : nodes[edge.target];
              return node ? { kind: "node" as const, label: node.label, text: getNormalizedText(node.text) } : null;
            })
            .filter(Boolean) as RelatedItem[]
        ),
        affectingEdges: dedupeRelatedItems(
          outgoingCurrent.map((edge) => ({ kind: "edge" as const, label: edge.label, text: getNormalizedText(edge.text) }))
        ),
      };
    }

    const edgeEntry = generation.edges[selectedTarget.id];
    if (!edgeEntry) return empty;

    const isCrossGen = crossGenerationEdgeIds.has(edgeEntry.templateId);
    const nextGeneration = session.generations.find(
      (item) => item.generationIndex === selectedTarget.generation + 1
    );
    const sourceNode = nodes[edgeEntry.source];
    const targetNode = isCrossGen ? nextGeneration?.nodes[edgeEntry.target] : nodes[edgeEntry.target];

    return {
      affectedNodes: sourceNode ? [{ kind: "node" as const, label: sourceNode.label, text: getNormalizedText(sourceNode.text) }] : [],
      affectedEdges: [] as RelatedItem[],
      affectingNodes: targetNode ? [{ kind: "node" as const, label: targetNode.label, text: getNormalizedText(targetNode.text) }] : [],
      affectingEdges: [] as RelatedItem[],
    };
  }, [session, selectedTarget]);

  // フォーム state
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [editingFields, setEditingFields] = useState<Record<string, string>>({});
  const [editingChips, setEditingChips] = useState<Record<string, string>>({});
  const [openYearPickerKey, setOpenYearPickerKey] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string> | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageReviewStatus, setImageReviewStatus] = useState<"idle" | "ok" | "insufficient">("idle");
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  // 画像
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageAnalyzing, setIsImageAnalyzing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 動画
  const [videoUrl, setVideoUrl] = useState("");
  const [isVideoAnalyzing, setIsVideoAnalyzing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // selectedTarget が変わるたびにフォームをリセット
  useEffect(() => {
    setInputMode("text");
    setImagePreview(null);
    setImageError(null);
    setVideoUrl("");
    setVideoError(null);
    setAiSuggestions(null);
    setAiError(null);
    setGeneratedImage(null);
    setImageReviewStatus("idle");
    setImageGenerationError(null);
    setOpenYearPickerKey(null);

    if (!selectedTarget || !selectedEntry) {
      setEditingFields({});
      setEditingChips({});
      setFreeText("");
      return;
    }

    const entryIndex = selectedTarget.entryIndex;
    if (entryIndex !== undefined && selectedEntry.fieldEntries[entryIndex]) {
      setEditingFields({ ...selectedEntry.fieldEntries[entryIndex] });
    } else {
      setEditingFields({});
    }
    setEditingChips({});
    setFreeText(selectedEntry.text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTarget]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setImageError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleImageAnalyze = async () => {
    if (!imagePreview || !selectedEntry) return;
    setIsImageAnalyzing(true);
    setImageError(null);

    try {
      const res = await fetch("/api/ai/image-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          label: selectedEntry.label,
          description: MODEL_DESCRIPTIONS[selectedEntry.label] ?? null,
          fieldDefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error ?? "画像解析に失敗しました。");
      } else {
        setEditingFields((prev) => ({ ...prev, ...data.suggestion }));
        setImagePreview(null);
        setInputMode("text");
      }
    } catch {
      setImageError("通信エラーが発生しました。");
    } finally {
      setIsImageAnalyzing(false);
    }
  };

  const handleVideoAnalyze = async () => {
    if (!videoUrl.trim() || !selectedEntry) return;
    setIsVideoAnalyzing(true);
    setVideoError(null);

    try {
      const res = await fetch("/api/ai/video-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          label: selectedEntry.label,
          description: MODEL_DESCRIPTIONS[selectedEntry.label] ?? null,
          fieldDefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoError(data.error ?? "動画解析に失敗しました。");
      } else {
        setEditingFields((prev) => ({ ...prev, ...data.suggestion }));
        setVideoUrl("");
        setInputMode("text");
      }
    } catch {
      setVideoError("通信エラーが発生しました。");
    } finally {
      setIsVideoAnalyzing(false);
    }
  };

  const fieldDefs = selectedEntry ? getFieldDefs(selectedEntry.label) : [];
  const hasFieldSchema = fieldDefs.length > 0;
  const isEditMode = selectedTarget?.entryIndex !== undefined;

  // chip とフィールドのマージ
  const mergedEditingFields = useMemo(() => {
    const merged = { ...editingFields };
    fieldDefs.forEach((def) => {
      if (def.chips && editingChips[def.key]) {
        merged[def.key] = editingChips[def.key];
      }
    });
    return merged;
  }, [editingFields, editingChips, fieldDefs]);

  const canConfirm = hasFieldSchema
    ? areAllFieldsFilled(selectedEntry?.label ?? "", mergedEditingFields)
    : Boolean(freeText.trim());
  const requiresImageReview = Boolean(generatedImage);
  const canSubmitEntry = canConfirm && !requiresImageReview;
  const shouldHighlightImageCheck =
    hasFieldSchema && canConfirm && !generatedImage && !isGeneratingImage;
  const shouldShowImageCheck = hasFieldSchema && (canConfirm || generatedImage || isGeneratingImage);
  const filledCount = fieldDefs.filter((def) => Boolean((mergedEditingFields[def.key] ?? "").trim())).length;
  const progressPercent = fieldDefs.length > 0 ? (filledCount / fieldDefs.length) * 100 : 0;

  const clearGeneratedImageReview = () => {
    setGeneratedImage(null);
    setImageReviewStatus("idle");
    setImageGenerationError(null);
  };

  const commitEntry = () => {
    if (!selectedTarget) return;

    if (!hasFieldSchema) {
      updateEdgeText(selectedTarget.generation, selectedTarget.id, freeText);
      return;
    }

    const currentEntries: FieldEntry[] = selectedEntry?.fieldEntries ?? [];
    const entryIndex = selectedTarget.entryIndex;
    const newEntries = entryIndex !== undefined
      ? currentEntries.map((e, i) => (i === entryIndex ? mergedEditingFields : e))
      : [...currentEntries, mergedEditingFields];

    if (selectedTarget.kind === "node") {
      setNodeFieldEntries(selectedTarget.generation, selectedTarget.id, newEntries);
    } else {
      setEdgeFieldEntries(selectedTarget.generation, selectedTarget.id, newEntries);
    }

    // 追加/更新後は新規追加モードにリセット
    selectTarget({
      generation: selectedTarget.generation,
      kind: selectedTarget.kind,
      id: selectedTarget.id,
    });
  };

  const handleConfirm = () => {
    if (!canSubmitEntry) return;
    commitEntry();
  };

  const handleApproveGeneratedImage = () => {
    if (!canConfirm) return;
    setImageReviewStatus("ok");
    commitEntry();
    clearGeneratedImageReview();
  };

  const handleCancel = () => {
    if (!selectedTarget) return;
    selectTarget({
      generation: selectedTarget.generation,
      kind: selectedTarget.kind,
      id: selectedTarget.id,
    });
  };

  const handleAiAssist = async () => {
    if (!selectedEntry || !session) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestions(null);

    const adjacentNodes = [
      ...relatedModels.affectedNodes,
      ...relatedModels.affectingNodes,
    ].filter((item) => Boolean(item.text?.trim()));

    const adjacentEdges = [
      ...relatedModels.affectedEdges,
      ...relatedModels.affectingEdges,
    ].filter((item) => Boolean(item.text?.trim()));

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedEntry.label,
          description: MODEL_DESCRIPTIONS[selectedEntry.label] ?? null,
          fieldDefs,
          currentFields: editingFields,
          sessionNodes: adjacentNodes.map((n) => ({ label: n.label, fields: {}, text: n.text })),
          sessionEdges: adjacentEdges.map((e) => ({ label: e.label, fields: {}, text: e.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "エラーが発生しました。");
      } else {
        setAiSuggestions(data.suggestion);
      }
    } catch {
      setAiError("通信エラーが発生しました。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateIntentImage = async () => {
    if (!selectedEntry || !hasFieldSchema) return;
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setGeneratedImage(null);
    setImageReviewStatus("idle");

    try {
      const res = await fetch("/api/ai/image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedEntry.label,
          description: MODEL_DESCRIPTIONS[selectedEntry.label] ?? null,
          fieldDefs,
          fields: mergedEditingFields,
        }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        setImageGenerationError(data.error ?? "画像生成に失敗しました。");
        return;
      }
      setGeneratedImage(data.imageUrl);
    } catch {
      setImageGenerationError("通信エラーが発生しました。");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const modelDescription =
    (selectedEntry && MODEL_DESCRIPTIONS[selectedEntry.label]) ||
    "このモデルが示す対象や関係について、具体的な観察や解釈を書きます。";
  const modelHint = selectedEntry ? MODEL_HINTS[selectedEntry.label] : null;
  const filledAffectedNodes = getFilledRelatedItems(relatedModels.affectedNodes);
  const filledAffectedEdges = getFilledRelatedItems(relatedModels.affectedEdges);
  const filledAffectingNodes = getFilledRelatedItems(relatedModels.affectingNodes);
  const filledAffectingEdges = getFilledRelatedItems(relatedModels.affectingEdges);

  return (
    <aside className="panel">
      <h2 className="panel-title">入力スペース</h2>

      {!selectedTarget && <p>左または中央から対象を選択してください。</p>}

      {selectedTarget && selectedEntry && (
        <>
          <div className="selected-box">
            <h3 className="selected-model-name">{selectedEntry.label}</h3>
            <p className="selected-model-description">{modelDescription}</p>
            {modelHint && (
              <div className="selected-model-hint">
                <span className="selected-model-hint-mark" aria-hidden="true">?</span>
                <p className="selected-model-hint-text">{modelHint}</p>
              </div>
            )}
          </div>

          {/* 関連モデル（ノード選択時のみ） */}
          {selectedTarget.kind === "node" && (
            <div className="related-model-layout">
              <label className="form-label" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>関連するもの</label>
              <div className="sub-box related-model-group-card">
                <p className="related-model-title">影響を受けるモデル</p>
                {filledAffectedNodes.length > 0 || filledAffectedEdges.length > 0 ? (
                  <>
                    {filledAffectedNodes.map((item) => (
                      <article key={`affected-node-${item.label}`} className="related-model-card">
                        <p className="related-model-card-name">{item.label}</p>
                        <p className="related-model-card-text">{item.text}</p>
                      </article>
                    ))}
                    {filledAffectedEdges.map((item) => (
                      <article key={`affected-edge-${item.label}`} className="related-model-card">
                        <p className="related-model-card-name">{item.label}</p>
                        <p className="related-model-card-text">{item.text}</p>
                      </article>
                    ))}
                  </>
                ) : (
                  <p className="related-model-empty">該当するモデルはまだありません。</p>
                )}
              </div>
              <div className="sub-box related-model-group-card">
                <p className="related-model-title">影響を与えるモデル</p>
                {filledAffectingNodes.length > 0 || filledAffectingEdges.length > 0 ? (
                  <>
                    {filledAffectingNodes.map((item) => (
                      <article key={`affecting-node-${item.label}`} className="related-model-card">
                        <p className="related-model-card-name">{item.label}</p>
                        <p className="related-model-card-text">{item.text}</p>
                      </article>
                    ))}
                    {filledAffectingEdges.map((item) => (
                      <article key={`affecting-edge-${item.label}`} className="related-model-card">
                        <p className="related-model-card-name">{item.label}</p>
                        <p className="related-model-card-text">{item.text}</p>
                      </article>
                    ))}
                  </>
                ) : (
                  <p className="related-model-empty">該当するモデルはまだありません。</p>
                )}
              </div>
            </div>
          )}

          {/* 入力フォーム */}
          <div className="entry-form-section">
            <div className="entry-form-section-header">
              <label className="form-label" style={{ margin: 0 }}>
                {isEditMode ? `#${(selectedTarget.entryIndex ?? 0) + 1} を編集` : "新しい記述を追加"}
              </label>
              {isEditMode && (
                <button type="button" className="entry-cancel-link" onClick={handleCancel}>
                  キャンセル
                </button>
              )}
            </div>

            {/* モード切替タブ（スキーマありのみ） */}
            {hasFieldSchema && (
              <div className="input-mode-tabs">
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "text" ? "input-mode-tab-active" : ""}`}
                  onClick={() => setInputMode("text")}
                  title="テキスト入力"
                >
                  <TextIcon />
                  <span>テキスト</span>
                </button>
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "image" ? "input-mode-tab-active" : ""}`}
                  onClick={() => {
                    setInputMode("image");
                    if (!imagePreview) fileInputRef.current?.click();
                  }}
                  title="画像から入力"
                >
                  <ImageIcon />
                  <span>画像</span>
                </button>
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "video" ? "input-mode-tab-active" : ""}`}
                  onClick={() => setInputMode("video")}
                  title="動画URLから入力"
                >
                  <VideoIcon />
                  <span>動画</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />
              </div>
            )}

            {/* ── テキスト入力パネル ── */}
            <div className={`input-mode-panel ${inputMode === "text" ? "input-mode-panel-open" : "input-mode-panel-closed"}`}>
              {hasFieldSchema ? (
                <div className="field-editor">
                  {fieldDefs.map((def) => {
                    const value = editingFields[def.key] ?? "";
                    const selectOptions = def.dependsOn
                      ? def.optionsByValue?.[mergedEditingFields[def.dependsOn] ?? ""] ?? []
                      : def.chips ?? [];
                    const isSelectField = selectOptions.length > 0 || Boolean(def.dependsOn);
                    const isUxYearField =
                      selectedEntry.label === "日常の空間とユーザー体験" && def.key === "when";
                    return (
                      <div key={def.key} className="field-group">
                        <div className="field-label-row">
                          <span className="field-label">{def.label}</span>
                        </div>
                        {isUxYearField ? (
                          <div className="year-picker-field">
                            <button
                              type="button"
                              className={`year-picker-summary ${value ? "year-picker-summary-selected" : ""}`}
                              onClick={() =>
                                setOpenYearPickerKey((current) => (current === def.key ? null : def.key))
                              }
                              aria-expanded={openYearPickerKey === def.key}
                            >
                              <span>{value || "年を選択"}</span>
                              <span className="year-picker-summary-action">
                                {openYearPickerKey === def.key ? "閉じる" : value ? "変更" : "選択"}
                              </span>
                            </button>
                            {openYearPickerKey === def.key && (
                              <YearPicker
                                value={value}
                                onChange={(year) => {
                                  setEditingFields((prev) => ({ ...prev, [def.key]: year }));
                                  setOpenYearPickerKey(null);
                                }}
                              />
                            )}
                          </div>
                        ) : isSelectField ? (
                          <select
                            className="field-select"
                            value={editingChips[def.key] ?? editingFields[def.key] ?? ""}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              const dependentKeys = fieldDefs
                                .filter((field) => field.dependsOn === def.key)
                                .map((field) => field.key);
                              setEditingChips((prev) => {
                                const next = { ...prev, [def.key]: nextValue };
                                dependentKeys.forEach((key) => {
                                  delete next[key];
                                });
                                return next;
                              });
                              setEditingFields((prev) => {
                                const next = { ...prev, [def.key]: nextValue };
                                dependentKeys.forEach((key) => {
                                  delete next[key];
                                });
                                return next;
                              });
                            }}
                            disabled={Boolean(def.dependsOn && selectOptions.length === 0)}
                          >
                            <option value="" disabled>
                              —
                            </option>
                            {selectOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            className="field-input"
                            value={value}
                            onChange={(e) => setEditingFields((prev) => ({ ...prev, [def.key]: e.target.value }))}
                            placeholder={def.placeholder ?? ""}
                            rows={2}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  className="form-textarea"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="ここに内容を入力"
                />
              )}

              {/* テキストモードの進捗・AIアシスト・確定ボタン */}
              {!hasFieldSchema && (
                <p className={`input-guide ${canConfirm ? "input-guide-ready" : ""}`}>
                  {canConfirm ? "入力できます。" : "内容を入力してください。"}
                </p>
              )}

              {aiError && <p className="ai-assist-error">{aiError}</p>}

              {shouldShowImageCheck && (
                <div className="intent-image-check">
                  <div className="intent-image-check-header">
                    <div>
                      <p className="intent-image-check-title">意図の画像確認</p>
                      <p className="intent-image-check-note">
                        入力した内容を画像化し、意図が反映されているか確認できます。
                      </p>
                    </div>
                    <button
                      type="button"
                      className={
                        canConfirm && !isGeneratingImage
                          ? `button-secondary intent-image-trigger ${shouldHighlightImageCheck ? "intent-image-trigger-ready" : ""}`
                          : "button-disabled"
                      }
                      onClick={handleGenerateIntentImage}
                      disabled={!canConfirm || isGeneratingImage}
                    >
                      {isGeneratingImage ? "画像生成中..." : generatedImage ? "画像を再生成" : "画像で確認"}
                    </button>
                  </div>

                  {imageGenerationError && <p className="ai-assist-error">{imageGenerationError}</p>}

                  {generatedImage && (
                    <div className="intent-image-result">
                      <img src={generatedImage} alt="入力意図の確認画像" className="intent-image-preview" />
                      <div className="intent-image-actions">
                        <button
                          type="button"
                          className={imageReviewStatus === "ok" ? "button-primary" : "button-secondary"}
                          onClick={handleApproveGeneratedImage}
                        >
                          OK・反映する
                        </button>
                        <button
                          type="button"
                          className={imageReviewStatus === "insufficient" ? "button-primary" : "button-secondary"}
                          onClick={() => setImageReviewStatus("insufficient")}
                        >
                          不十分
                        </button>
                      </div>
                      {imageReviewStatus === "insufficient" && (
                        <p className="intent-image-feedback intent-image-feedback-warn">
                          まだ反映しません。テキスト入力をより具体的にしてから、画像を再生成してください。対象、場面、利用者、変化、制約を追加すると反映されやすくなります。
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {aiSuggestions && hasFieldSchema && (
                <div className="ai-assist-suggestions">
                  <p className="ai-assist-suggestions-title">AIの提案</p>
                  {fieldDefs.map((def) => {
                    const suggestion = aiSuggestions[def.key];
                    if (!suggestion) return null;
                    return (
                      <div key={def.key} className="ai-assist-suggestion-item">
                        <div className="ai-assist-suggestion-header">
                          <span className="ai-assist-suggestion-label">{def.label}</span>
                          <button
                            type="button"
                            className="ai-assist-use-button"
                            onClick={() => setEditingFields((prev) => ({ ...prev, [def.key]: suggestion }))}
                          >
                            使う
                          </button>
                        </div>
                        <p className="ai-assist-suggestion-text">{suggestion}</p>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="ai-assist-use-all-button"
                    onClick={() => {
                      const merged = { ...editingFields };
                      fieldDefs.forEach((def) => { if (aiSuggestions[def.key]) merged[def.key] = aiSuggestions[def.key]; });
                      setEditingFields(merged);
                      setAiSuggestions(null);
                    }}
                  >
                    すべて使う
                  </button>
                </div>
              )}

              <div className="entry-form-actions">
                {hasFieldSchema && (
                  <div
                    className="field-progress-ring"
                    style={{ "--field-progress": `${progressPercent}%` } as React.CSSProperties}
                    aria-label={`${filledCount} / ${fieldDefs.length} 項目入力済み`}
                  >
                    <span className="field-progress-count">{filledCount}</span>
                    <span className="field-progress-total">/{fieldDefs.length}</span>
                  </div>
                )}
                <div className="entry-form-action-buttons">
                  <button type="button" className="button-secondary" onClick={handleAiAssist} disabled={isAiLoading}>
                    {isAiLoading ? "AIが考え中…" : "AIアシスト"}
                  </button>
                  <button
                    type="button"
                    className={canSubmitEntry ? "button-primary" : "button-secondary"}
                    onClick={handleConfirm}
                    disabled={!canSubmitEntry}
                  >
                    {requiresImageReview
                      ? "画像のOKで反映"
                      : isEditMode ? "更新" : "追加"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── 画像入力パネル ── */}
            {hasFieldSchema && (
              <div className={`input-mode-panel ${inputMode === "image" ? "input-mode-panel-open" : "input-mode-panel-closed"}`}>
                {imagePreview ? (
                  <div className="image-preview-area">
                    <img src={imagePreview} alt="選択した画像" className="image-preview" />
                    <div className="image-preview-actions">
                      <button type="button" className="button-secondary" onClick={() => { setImagePreview(null); fileInputRef.current?.click(); }}>
                        画像を変更
                      </button>
                      <button
                        type="button"
                        className={isImageAnalyzing ? "button-secondary" : "button-primary"}
                        onClick={handleImageAnalyze}
                        disabled={isImageAnalyzing}
                      >
                        {isImageAnalyzing ? "解析中…" : "AIで解析して入力"}
                      </button>
                    </div>
                    {imageError && <p className="ai-assist-error">{imageError}</p>}
                  </div>
                ) : (
                  <button type="button" className="image-select-placeholder" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon />
                    <span>クリックして画像を選択</span>
                  </button>
                )}
              </div>
            )}

            {/* ── 動画入力パネル ── */}
            {hasFieldSchema && (
              <div className={`input-mode-panel ${inputMode === "video" ? "input-mode-panel-open" : "input-mode-panel-closed"}`}>
                <div className="video-input-area">
                  <input
                    type="url"
                    className="field-input"
                    value={videoUrl}
                    onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
                    placeholder="YouTube や Vimeo の URL を貼り付け"
                  />
                  {videoError && <p className="ai-assist-error">{videoError}</p>}
                  <button
                    type="button"
                    className={videoUrl.trim() && !isVideoAnalyzing ? "button-primary" : "button-secondary"}
                    onClick={handleVideoAnalyze}
                    disabled={!videoUrl.trim() || isVideoAnalyzing}
                  >
                    {isVideoAnalyzing ? "解析中…" : "AIで解析して入力"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
