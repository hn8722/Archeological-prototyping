"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, SquarePlay } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { FieldEntry, NodeEntry, EdgeEntry } from "@/lib/types/ap";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";
import { getFieldDefs, areAllFieldsFilled } from "@/lib/templates/fieldSchema";
import { MODEL_DESCRIPTIONS, MODEL_HINTS } from "@/lib/templates/modelDescriptions";
import { OnlineMember } from "@/lib/realtime/useOnlineMembers";

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
const IMAGE_ANALYZE_MAX_DIMENSION = 1280;
const IMAGE_ANALYZE_JPEG_QUALITY = 0.82;
const IMAGE_CONFIRMATION_LABELS = new Set([
  "日常の空間とユーザー体験",
  "ペルソナ",
]);

async function fileToCompressedDataUrl(file: File) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = sourceUrl;
    });

    const scale = Math.min(
      1,
      IMAGE_ANALYZE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");

    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", IMAGE_ANALYZE_JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

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

export function RightPanel({ collaborationPeers = [] }: { collaborationPeers?: OnlineMember[] }) {
  const session = useSessionStore((state) => state.session);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const appendNodeFieldEntry = useSessionStore((state) => state.appendNodeFieldEntry);
  const appendEdgeFieldEntry = useSessionStore((state) => state.appendEdgeFieldEntry);
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

  const entryLockOwner = useMemo(() => {
    if (!selectedTarget || selectedTarget.entryIndex === undefined) return null;

    return collaborationPeers.find((member) => {
      const target = member.selectedTarget;
      return Boolean(
        target &&
          target.mode === "editing" &&
          target.kind === selectedTarget.kind &&
          target.generation === selectedTarget.generation &&
          target.id === selectedTarget.id &&
          target.entryIndex === selectedTarget.entryIndex
      );
    }) ?? null;
  }, [collaborationPeers, selectedTarget]);

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyEntry) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await fileToCompressedDataUrl(file);
      setImagePreview(compressedDataUrl);
      setImageError(null);
    } catch {
      setImageError("画像の読み込みに失敗しました。別の画像で試してください。");
    }

    e.target.value = "";
  };

  const handleImageAnalyze = async () => {
    if (!imagePreview || !selectedEntry || isReadOnlyEntry) return;
    setIsImageAnalyzing(true);
    setImageError(null);

    try {
      const res = await fetch("/api/ai/image-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
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
    if (!videoUrl.trim() || !selectedEntry || isReadOnlyEntry) return;
    setIsVideoAnalyzing(true);
    setVideoError(null);

    try {
      const res = await fetch("/api/ai/video-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
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
  const isReadOnlyEntry = Boolean(
    isEditMode && (entryLockOwner || selectedTarget?.mode === "viewing")
  );

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
  const canUseImageConfirmation = Boolean(
    selectedEntry && IMAGE_CONFIRMATION_LABELS.has(selectedEntry.label)
  );
  const requiresImageReview = Boolean(generatedImage);
  const canSubmitEntry = canConfirm && !requiresImageReview && !isReadOnlyEntry;
  const shouldHighlightImageCheck =
    canUseImageConfirmation && hasFieldSchema && canConfirm && !generatedImage && !isGeneratingImage && !isReadOnlyEntry;
  const shouldShowImageCheck =
    canUseImageConfirmation && hasFieldSchema && (canConfirm || generatedImage || isGeneratingImage) && !isReadOnlyEntry;
  const filledCount = fieldDefs.filter((def) => Boolean((mergedEditingFields[def.key] ?? "").trim())).length;
  const progressPercent = fieldDefs.length > 0 ? (filledCount / fieldDefs.length) * 100 : 0;

  const clearGeneratedImageReview = () => {
    setGeneratedImage(null);
    setImageReviewStatus("idle");
    setImageGenerationError(null);
  };

  const commitEntry = () => {
    if (!selectedTarget || isReadOnlyEntry) return;

    if (!hasFieldSchema) {
      updateEdgeText(selectedTarget.generation, selectedTarget.id, freeText);
      return;
    }

    const currentEntries: FieldEntry[] = selectedEntry?.fieldEntries ?? [];
    const entryIndex = selectedTarget.entryIndex;

    if (entryIndex === undefined) {
      if (selectedTarget.kind === "node") {
        appendNodeFieldEntry(selectedTarget.generation, selectedTarget.id, mergedEditingFields);
      } else {
        appendEdgeFieldEntry(selectedTarget.generation, selectedTarget.id, mergedEditingFields);
      }
    } else {
      const newEntries = currentEntries.map((e, i) => (i === entryIndex ? mergedEditingFields : e));

      if (selectedTarget.kind === "node") {
        setNodeFieldEntries(selectedTarget.generation, selectedTarget.id, newEntries);
      } else {
        setEdgeFieldEntries(selectedTarget.generation, selectedTarget.id, newEntries);
      }
    }

    // 追加/更新後は新規追加モードにリセット
    selectTarget({
      generation: selectedTarget.generation,
      kind: selectedTarget.kind,
      id: selectedTarget.id,
    });
  };

  const handleConfirm = () => {
    if (!canSubmitEntry || isReadOnlyEntry) return;
    commitEntry();
  };

  const handleApproveGeneratedImage = () => {
    if (!canConfirm || isReadOnlyEntry) return;
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
    if (!selectedEntry || !session || isReadOnlyEntry) return;
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
          sessionId: session.id,
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
    if (!selectedEntry || !hasFieldSchema || !canUseImageConfirmation || isReadOnlyEntry) return;
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setGeneratedImage(null);
    setImageReviewStatus("idle");

    try {
      const res = await fetch("/api/ai/image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
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
            {isReadOnlyEntry && (
              <p className="entry-lock-notice">
                {entryLockOwner
                  ? `${entryLockOwner.displayName} が編集中です。内容は閲覧できます。`
                  : "この記述は閲覧モードです。"}
              </p>
            )}

            {hasFieldSchema && (
              <div className="input-mode-tabs">
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "text" ? "input-mode-tab-active" : ""}`}
                  onClick={() => setInputMode("text")}
                  disabled={isReadOnlyEntry}
                  title="テキスト入力"
                >
                  <TextIcon />
                  <span>テキスト</span>
                </button>
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "image" ? "input-mode-tab-active" : ""}`}
                  onClick={() => {
                    if (isReadOnlyEntry) return;
                    setInputMode("image");
                    if (!imagePreview) fileInputRef.current?.click();
                  }}
                  disabled={isReadOnlyEntry}
                  title="画像から入力"
                >
                  <ImageIcon />
                  <span>画像</span>
                </button>
                <button
                  type="button"
                  className={`input-mode-tab ${inputMode === "video" ? "input-mode-tab-active" : ""}`}
                  onClick={() => setInputMode("video")}
                  disabled={isReadOnlyEntry}
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
                              disabled={isReadOnlyEntry}
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
                                  if (isReadOnlyEntry) return;
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
                            disabled={isReadOnlyEntry || Boolean(def.dependsOn && selectOptions.length === 0)}
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
                            disabled={isReadOnlyEntry}
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
                  disabled={isReadOnlyEntry}
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
                      disabled={!canConfirm || isGeneratingImage || isReadOnlyEntry}
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
                          disabled={isReadOnlyEntry}
                        >
                          OK・反映する
                        </button>
                        <button
                          type="button"
                          className={imageReviewStatus === "insufficient" ? "button-primary" : "button-secondary"}
                          onClick={() => {
                            if (isReadOnlyEntry) return;
                            setImageReviewStatus("insufficient");
                          }}
                          disabled={isReadOnlyEntry}
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
                            onClick={() => {
                              if (isReadOnlyEntry) return;
                              setEditingFields((prev) => ({ ...prev, [def.key]: suggestion }));
                            }}
                            disabled={isReadOnlyEntry}
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
                      if (isReadOnlyEntry) return;
                      const merged = { ...editingFields };
                      fieldDefs.forEach((def) => { if (aiSuggestions[def.key]) merged[def.key] = aiSuggestions[def.key]; });
                      setEditingFields(merged);
                      setAiSuggestions(null);
                    }}
                    disabled={isReadOnlyEntry}
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
                  <button type="button" className="button-secondary" onClick={handleAiAssist} disabled={isAiLoading || isReadOnlyEntry} aria-label="AIアシスト">
                    <Bot size={16} />
                    <span className="icon-tooltip">AIアシスト</span>
                  </button>
                  <button
                    type="button"
                    className={canSubmitEntry ? "button-primary" : "button-secondary"}
                    onClick={handleConfirm}
                    disabled={!canSubmitEntry}
                    aria-label={requiresImageReview ? "画像のOKで反映" : isEditMode ? "更新" : "追加"}
                  >
                    <SquarePlay size={16} />
                    <span className="icon-tooltip">
                      {requiresImageReview ? "画像のOKで反映" : isEditMode ? "更新" : "追加"}
                    </span>
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
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          if (isReadOnlyEntry) return;
                          setImagePreview(null);
                          fileInputRef.current?.click();
                        }}
                        disabled={isReadOnlyEntry}
                      >
                        画像を変更
                      </button>
                      <button
                        type="button"
                        className={isImageAnalyzing ? "button-secondary" : "button-primary"}
                        onClick={handleImageAnalyze}
                        disabled={isImageAnalyzing || isReadOnlyEntry}
                      >
                        {isImageAnalyzing ? "解析中…" : "AIで解析して入力"}
                      </button>
                    </div>
                    {imageError && <p className="ai-assist-error">{imageError}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="image-select-placeholder"
                    onClick={() => {
                      if (isReadOnlyEntry) return;
                      fileInputRef.current?.click();
                    }}
                    disabled={isReadOnlyEntry}
                  >
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
                    onChange={(e) => {
                      if (isReadOnlyEntry) return;
                      setVideoUrl(e.target.value);
                      setVideoError(null);
                    }}
                    disabled={isReadOnlyEntry}
                    placeholder="YouTube や Vimeo の URL を貼り付け"
                  />
                  {videoError && <p className="ai-assist-error">{videoError}</p>}
                  <button
                    type="button"
                    className={videoUrl.trim() && !isVideoAnalyzing ? "button-primary" : "button-secondary"}
                    onClick={handleVideoAnalyze}
                    disabled={!videoUrl.trim() || isVideoAnalyzing || isReadOnlyEntry}
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
