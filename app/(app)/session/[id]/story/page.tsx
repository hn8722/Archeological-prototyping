"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSessionStore } from "@/store/useSessionStore";
import { FieldEntry, SessionModel } from "@/lib/types/ap";
import { formatGenerationLabel } from "@/lib/utils/generationLabel";

type StoryParams = {
  genre: string;
  perspective: string;
  style: string;
  characterNote: string;
};

type StoryPreview = {
  theme: string;
  openingLine: string;
  directionLabel: string;
  directionNote: string;
  scenarioPlan: string;
};

type GenerationStory = {
  generation: number;
  title: string;
  text: string;
  carryover?: string;
};

type PersonaCandidate = {
  key: string;
  generation: number;
  entryIndex: number;
  text: string;
  fields?: FieldEntry;
};

const GENRE_OPTIONS = ["指定なし", "恋愛", "SF", "ミステリー", "純文学", "ファンタジー", "ドラマ", "ホラー", "歴史"];
const PERSPECTIVE_OPTIONS = ["指定なし", "三人称（神視点）", "一人称（主人公視点）", "群像劇"];
const STYLE_OPTIONS = ["指定なし", "標準", "詩的・叙情的", "テンポよく短め", "重厚・長め"];

const DEFAULT_PARAMS: StoryParams = {
  genre: "指定なし",
  perspective: "指定なし",
  style: "指定なし",
  characterNote: "",
};

function sanitizeFileName(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  return cleaned || "ap-story";
}

function formatPersonaFields(fields?: FieldEntry) {
  if (!fields) return "";
  const labels: Record<string, string> = {
    demographic: "デモグラフィック",
    sociographic: "ソシオグラフィック",
    personaTagline: "一言",
    goal: "ゴール",
  };
  return Object.entries(fields)
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `${labels[key] ?? key}: ${value}`)
    .join("\n");
}

function collectPersonaCandidates(session: SessionModel | null): PersonaCandidate[] {
  if (!session) return [];

  return [...session.generations]
    .sort((a, b) => a.generationIndex - b.generationIndex)
    .flatMap((generation) => {
      const personaNode = generation.nodes.n6;
      if (!personaNode) return [];

      const fieldCandidates = personaNode.fieldEntries
        .map((fields, index) => {
          const fieldText = formatPersonaFields(fields);
          return {
            key: `${generation.generationIndex}:n6:${index}`,
            generation: generation.generationIndex,
            entryIndex: index,
            text: fieldText || personaNode.text?.trim() || "",
            fields,
          };
        })
        .filter((candidate) => candidate.text.trim());

      if (fieldCandidates.length > 0) return fieldCandidates;
      const fallbackText = personaNode.text?.trim();
      if (!fallbackText) return [];

      return [{
        key: `${generation.generationIndex}:n6:text`,
        generation: generation.generationIndex,
        entryIndex: -1,
        text: fallbackText,
      }];
    });
}

function buildStoryMarkdown({
  sessionName,
  story,
  generationStories,
  storyParams,
  personas,
}: {
  sessionName: string;
  story: string;
  generationStories: GenerationStory[];
  storyParams: StoryParams;
  personas: PersonaCandidate[];
}) {
  const lines = [
    `# ${sessionName} 小説`,
    "",
    "## 生成条件",
    "",
    `- ジャンル: ${storyParams.genre}`,
    `- 視点: ${storyParams.perspective}`,
    `- 文体: ${storyParams.style}`,
    storyParams.characterNote.trim() ? `- 登場人物・設定メモ: ${storyParams.characterNote.trim()}` : null,
    "",
    "## 使用したペルソナ",
    "",
    ...personas.flatMap((persona, index) => [
      `### ペルソナ${index + 1}（${formatGenerationLabel(persona.generation)}）`,
      persona.text,
      "",
    ]),
    "## 本文",
    "",
    generationStories.length > 0
      ? generationStories.map((item) => item.text).join("\n\n")
      : story,
    "",
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="story-param-group">
      <span className="story-param-label">{label}</span>
      <div className="story-param-chips">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`story-param-chip ${value === opt ? "story-param-chip-selected" : ""}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sessionFromStore = useSessionStore((state) => state.session);
  const [session, setSession] = useState<SessionModel | null>(sessionFromStore);
  const [story, setStory] = useState("");
  const [generationStories, setGenerationStories] = useState<GenerationStory[]>([]);
  const [previews, setPreviews] = useState<StoryPreview[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [selectedPersonaKeys, setSelectedPersonaKeys] = useState<Set<string>>(new Set());
  const [expandedPersonaKey, setExpandedPersonaKey] = useState<string | null>(null);
  const [isPersonaAutoScrollPaused, setIsPersonaAutoScrollPaused] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingStory, setIsSavingStory] = useState(false);
  const [isStorySaved, setIsStorySaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [storyModel, setStoryModel] = useState<string | null>(null);
  const [storyParams, setStoryParams] = useState<StoryParams>(DEFAULT_PARAMS);

  useEffect(() => {
    if (sessionFromStore?.id === id) {
      setSession(sessionFromStore);
      return;
    }

    let isActive = true;

    const loadSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load session");
        const data = (await response.json()) as { session?: SessionModel };
        if (isActive) setSession(data.session ?? null);
      } catch (error) {
        console.error(error);
        if (isActive) setErrorMessage("セッションの読み込みに失敗しました。");
      }
    };

    void loadSession();
    return () => { isActive = false; };
  }, [id, sessionFromStore]);

  const personaCandidates = useMemo(() => collectPersonaCandidates(session), [session]);
  const personaSignature = personaCandidates.map((persona) => persona.key).join("|");

  useEffect(() => {
    setSelectedPersonaKeys(new Set(personaCandidates.map((persona) => persona.key)));
  }, [personaSignature]);

  useEffect(() => {
    if (expandedPersonaKey && !personaCandidates.some((persona) => persona.key === expandedPersonaKey)) {
      setExpandedPersonaKey(null);
    }
  }, [expandedPersonaKey, personaCandidates]);

  const selectedPersonas = personaCandidates.filter((persona) => selectedPersonaKeys.has(persona.key));

  const setParam = <K extends keyof StoryParams>(key: K, value: StoryParams[K]) => {
    setStoryParams((prev) => ({ ...prev, [key]: value }));
  };

  const saveSessionBeforeStory = async () => {
    if (!session) return;
    const saveResponse = await fetch(`/api/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
    if (!saveResponse.ok) throw new Error("Failed to save session before generating story");
  };

  const buildSelectedPersonaPayload = () =>
    selectedPersonas.map((persona) => ({
      key: persona.key,
      generation: persona.generation,
      entryIndex: persona.entryIndex,
      text: persona.text,
      fields: persona.fields,
    }));

  const ensurePersonaSelected = () => {
    if (selectedPersonas.length > 0) return true;
    setErrorMessage("小説生成に使うペルソナを1つ以上選択してください。");
    return false;
  };

  const handlePreview = async () => {
    if (!ensurePersonaSelected()) return;

    setIsPreviewing(true);
    setErrorMessage("");
    setPreviews([]);
    setSelectedPreviewIndex(0);
    setStory("");
    setGenerationStories([]);
    setIsStorySaved(false);
    setSaveMessage("");
    setStoryModel(null);

    try {
      await saveSessionBeforeStory();

      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          params: storyParams,
          selectedPersonas: buildSelectedPersonaPayload(),
        }),
      });

      const data = (await response.json()) as {
        previews?: StoryPreview[];
        error?: string;
      };

      if (!response.ok || !data.previews?.length) {
        throw new Error(data.error || "Failed to generate story preview");
      }

      setPreviews(data.previews.slice(0, 3));
      setSelectedPreviewIndex(0);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "方向性の確認生成に失敗しました。");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    const selectedPreview = previews[selectedPreviewIndex];
    if (!selectedPreview || !ensurePersonaSelected()) return;

    setIsGenerating(true);
    setErrorMessage("");
    setStory("");
    setGenerationStories([]);
    setIsStorySaved(false);
    setSaveMessage("");
    setStoryModel(null);

    try {
      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          params: storyParams,
          scenarioPlan: selectedPreview.scenarioPlan,
          selectedPersonas: buildSelectedPersonaPayload(),
        }),
      });

      const data = (await response.json()) as {
        story?: string;
        generationStories?: GenerationStory[];
        model?: string;
        error?: string;
      };

      if (!response.ok || !data.story) {
        throw new Error(data.error || "Failed to generate story");
      }

      setStory(data.story);
      setGenerationStories(data.generationStories ?? []);
      setStoryModel(data.model ?? null);
      setIsStorySaved(false);
      setSaveMessage("生成結果はまだアプリに保存されていません。残す場合は保存してください。");
      setPreviews([]);
      setSelectedPreviewIndex(0);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "小説生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveStoryToApp = async () => {
    if (!story) return;
    setIsSavingStory(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          story,
          model: storyModel,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to save story");
      }

      setIsStorySaved(true);
      setSaveMessage("小説をアプリに保存しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "小説の保存に失敗しました。");
    } finally {
      setIsSavingStory(false);
    }
  };

  const handleDownloadStory = () => {
    if (!story || !session) return;

    const markdown = buildStoryMarkdown({
      sessionName: session.name,
      story,
      generationStories,
      storyParams,
      personas: selectedPersonas,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `${sanitizeFileName(session.name)}-story-${date}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const togglePersona = (key: string) => {
    setSelectedPersonaKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreviews([]);
    setStory("");
    setGenerationStories([]);
  };

  const setAllPersonas = (checked: boolean) => {
    setSelectedPersonaKeys(checked ? new Set(personaCandidates.map((persona) => persona.key)) : new Set());
    setPreviews([]);
    setStory("");
    setGenerationStories([]);
  };

  const renderPersonaSelector = () => (
    <div className="story-param-group story-persona-group">
      <div className="story-persona-header">
        <span className="story-param-label">主人公に含めるペルソナ</span>
        {personaCandidates.length > 0 && (
          <label className="story-persona-select-all">
            <input
              type="checkbox"
              checked={selectedPersonas.length === personaCandidates.length}
              onChange={(event) => setAllPersonas(event.target.checked)}
            />
            すべて含める
          </label>
        )}
      </div>
      {personaCandidates.length > 0 ? (
        <div className="story-persona-scroll" aria-label="主人公に含めるペルソナ">
          <div
            className={`story-persona-track ${personaCandidates.length > 2 ? "story-persona-track-animated" : ""} ${isPersonaAutoScrollPaused ? "story-persona-track-paused" : ""}`}
            onWheel={() => setIsPersonaAutoScrollPaused(true)}
            onPointerDown={() => setIsPersonaAutoScrollPaused(true)}
            onTouchStart={() => setIsPersonaAutoScrollPaused(true)}
          >
          {personaCandidates.map((persona) => {
            const isSelected = selectedPersonaKeys.has(persona.key);
            const isExpanded = expandedPersonaKey === persona.key;
            const firstLine = persona.text.split("\n").find((line) => line.trim()) ?? persona.text;
            return (
              <button
                key={persona.key}
                type="button"
                className={`story-persona-card ${isSelected ? "story-persona-card-selected" : ""} ${isExpanded ? "story-persona-card-expanded" : ""}`}
                onClick={() => setExpandedPersonaKey(isExpanded ? null : persona.key)}
                aria-expanded={isExpanded}
              >
                <span className="story-persona-card-top">
                  <span className="story-persona-avatar" aria-hidden="true">
                    {formatGenerationLabel(persona.generation).slice(0, 1)}
                  </span>
                  <span className="story-persona-card-meta">
                    <span className="story-persona-generation">{formatGenerationLabel(persona.generation)}</span>
                    <span className="story-persona-summary">{firstLine}</span>
                  </span>
                  <span
                    className="story-persona-checkbox"
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePersona(persona.key);
                    }}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePersona(persona.key);
                      }
                    }}
                  >
                    {isSelected ? "OK" : ""}
                  </span>
                </span>
                {isExpanded && (
                  <span className="story-persona-detail">
                    {persona.text}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      ) : (
        <p className="page-description">小説生成に使うペルソナがまだ入力されていません。編集画面で「ペルソナ」を追加してください。</p>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">小説生成</h1>

      <div className="story-params-card">
        {false && (
        <div className="story-param-group">
          <span className="story-param-label">主人公に含めるペルソナ</span>
          {personaCandidates.length > 0 ? (
            <>
              <label className="gallery-import-mode" style={{ alignSelf: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={selectedPersonas.length === personaCandidates.length}
                  onChange={(event) => setAllPersonas(event.target.checked)}
                />
                すべて含める
              </label>
              <div className="gallery-node-grid">
                {personaCandidates.map((persona) => {
                  const isSelected = selectedPersonaKeys.has(persona.key);
                  return (
                    <button
                      key={persona.key}
                      type="button"
                      className={`gallery-node-card ${isSelected ? "gallery-node-card-selected" : ""}`}
                      onClick={() => togglePersona(persona.key)}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <span className="gallery-node-check">OK</span>}
                      <span className="gallery-node-label">{formatGenerationLabel(persona.generation)} / ペルソナ</span>
                      <span className="gallery-node-text" style={{ whiteSpace: "pre-wrap" }}>{persona.text}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="page-description">小説生成に使うペルソナがまだ入力されていません。編集画面で「ペルソナ」を追加してください。</p>
          )}
        </div>
        )}

        <ChipGroup
          label="ジャンル"
          options={GENRE_OPTIONS}
          value={storyParams.genre}
          onChange={(v) => setParam("genre", v)}
        />
        <ChipGroup
          label="視点"
          options={PERSPECTIVE_OPTIONS}
          value={storyParams.perspective}
          onChange={(v) => setParam("perspective", v)}
        />
        <ChipGroup
          label="文体"
          options={STYLE_OPTIONS}
          value={storyParams.style}
          onChange={(v) => setParam("style", v)}
        />

        {renderPersonaSelector()}

        <div className="story-param-group">
          <span className="story-param-label">登場人物・設定メモ（任意）</span>
          <textarea
            className="story-param-textarea"
            value={storyParams.characterNote}
            onChange={(e) => setParam("characterNote", e.target.value)}
            placeholder="例: 舞台は海沿いの地方都市。行政窓口、商店街、移動サービスの待合所を中心に描く。"
            rows={3}
          />
        </div>
      </div>

      {previews.length > 0 && (
        <div className="story-direction-card">
          <div className="story-direction-header">
            <p className="story-direction-label">生成前の方向性確認</p>
            <span className="story-direction-selected">選択中: 案{selectedPreviewIndex + 1}</span>
          </div>
          <div className="story-direction-options">
            {previews.map((item, index) => {
              const isSelected = selectedPreviewIndex === index;
              return (
                <button
                  key={`${item.directionLabel}-${index}`}
                  type="button"
                  className={`story-direction-option ${isSelected ? "story-direction-option-selected" : ""}`}
                  onClick={() => setSelectedPreviewIndex(index)}
                  aria-pressed={isSelected}
                >
                  <span className="story-direction-option-kicker">案{index + 1}</span>
                  <span className="story-direction-option-title">{item.directionLabel}</span>
                  <span className="story-direction-heading">テーマ</span>
                  <span className="story-direction-option-text">{item.theme}</span>
                  <span className="story-direction-heading">最初の一行</span>
                  <span className="story-direction-option-text">{item.openingLine}</span>
                  {item.directionNote && (
                    <span className="story-direction-option-note">{item.directionNote}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="story-direction-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={handlePreview}
              disabled={isPreviewing || isGenerating}
            >
              {isPreviewing ? "再生成中..." : "方向性を再生成"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "本文生成中..." : `案${selectedPreviewIndex + 1}で本文生成`}
            </button>
          </div>
        </div>
      )}

      {generationStories.length > 0 ? (
        <div className="story-generation-list">
          {generationStories.map((item) => (
            <article key={item.generation} className="story-generation-card">
              <p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p>
            </article>
          ))}
        </div>
      ) : story && (
        <div className="story-box">
          <p style={{ whiteSpace: "pre-wrap" }}>{story}</p>
        </div>
      )}

      {story && (
        <div className="story-footer-actions">
          <button
            type="button"
            className="button-primary"
            onClick={handleSaveStoryToApp}
            disabled={isSavingStory || isStorySaved}
          >
            {isSavingStory ? "保存中..." : isStorySaved ? "アプリに保存済み" : "アプリに保存"}
          </button>
          <button type="button" className="button-secondary" onClick={handleDownloadStory}>
            Markdownで保存
          </button>
        </div>
      )}

      {saveMessage && <p className="page-description">{saveMessage}</p>}
      {errorMessage && <p className="page-description" style={{ color: "#d92d20" }}>{errorMessage}</p>}

      <div className="story-footer-actions">
        <Link href={`/session/${id}`} className="button-secondary">
          編集画面へ戻る
        </Link>
        {previews.length === 0 && (
          <button
            className="button-primary"
            onClick={handlePreview}
            disabled={isPreviewing || isGenerating || !session || personaCandidates.length === 0}
          >
            {isPreviewing ? "方向性生成中..." : generationStories.length > 0 ? "方向性から作り直す" : "方向性を確認する"}
          </button>
        )}
      </div>
    </div>
  );
}
