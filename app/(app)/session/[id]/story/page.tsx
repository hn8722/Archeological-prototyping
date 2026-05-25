"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSessionStore } from "@/store/useSessionStore";
import { SessionModel } from "@/lib/types/ap";

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
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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

  const handlePreview = async () => {
    setIsPreviewing(true);
    setErrorMessage("");
    setPreviews([]);
    setSelectedPreviewIndex(0);
    setStory("");
    setGenerationStories([]);

    try {
      await saveSessionBeforeStory();

      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", params: storyParams }),
      });

      const data = (await response.json()) as {
        previews?: StoryPreview[];
        error?: string;
      } & Partial<StoryPreview>;

      const nextPreviews = data.previews?.length
        ? data.previews
        : data.scenarioPlan
          ? [{
              theme: data.theme ?? "テーマを取得できませんでした",
              openingLine: data.openingLine ?? "最初の一行を取得できませんでした",
              directionLabel: data.directionLabel ?? "方向性案",
              directionNote: data.directionNote ?? "",
              scenarioPlan: data.scenarioPlan,
            }]
          : [];

      if (!response.ok || nextPreviews.length === 0) {
        throw new Error(data.error || "Failed to generate story preview");
      }

      setPreviews(nextPreviews.slice(0, 3));
      setSelectedPreviewIndex(0);
    } catch (error) {
      console.error(error);
      setErrorMessage("方向性の確認生成に失敗しました。OPENAI_API_KEY も確認してください。");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    const selectedPreview = previews[selectedPreviewIndex];
    if (!selectedPreview) return;
    setIsGenerating(true);
    setErrorMessage("");
    setStory("");
    setGenerationStories([]);

    try {
      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          params: storyParams,
          scenarioPlan: selectedPreview.scenarioPlan,
        }),
      });

      const data = (await response.json()) as {
        story?: string;
        generationStories?: GenerationStory[];
        error?: string;
      };

      if (!response.ok || !data.story) {
        throw new Error(data.error || "Failed to generate story");
      }

      setStory(data.story);
      setGenerationStories(data.generationStories ?? []);
      setPreviews([]);
      setSelectedPreviewIndex(0);
    } catch (error) {
      console.error(error);
      setErrorMessage("小説生成に失敗しました。OPENAI_API_KEY も確認してください。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">小説生成</h1>

      {/* パラメータUI */}
      <div className="story-params-card">

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

        <div className="story-param-group">
          <span className="story-param-label">登場人物・設定のメモ（任意）</span>
          <textarea
            className="story-param-textarea"
            value={storyParams.characterNote}
            onChange={(e) => setParam("characterNote", e.target.value)}
            placeholder="例：主人公は30代の女性エンジニア。舞台は東京の下町。"
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

      {/* 生成結果 */}
      {generationStories.length > 0 ? (
        <div className="story-generation-list">
          {generationStories.map((item) => (
            <article key={item.generation} className="story-generation-card">
              <span className="story-generation-kicker">第{item.generation}世代</span>
              <h2>{item.title}</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p>
            </article>
          ))}
        </div>
      ) : story && (
        <div className="story-box">
          <p style={{ whiteSpace: "pre-wrap" }}>{story}</p>
        </div>
      )}

      {errorMessage && <p className="page-description" style={{ color: "#d92d20" }}>{errorMessage}</p>}

      <div className="story-footer-actions">
        <Link href={`/session/${id}`} className="button-secondary">
          編集画面へ戻る
        </Link>
        {previews.length === 0 && (
          <button
            className="button-primary"
            onClick={handlePreview}
            disabled={isPreviewing || isGenerating || !session}
          >
            {isPreviewing ? "方向性生成中..." : generationStories.length > 0 ? "方向性から作り直す" : "方向性を確認する"}
          </button>
        )}
      </div>
    </div>
  );
}
