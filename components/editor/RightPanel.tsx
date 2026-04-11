"use client";

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { NodeEntry, EdgeEntry } from "@/lib/types/ap";
import { AP_CROSS_GENERATION_EDGES } from "@/lib/templates/apTemplate";

type RelatedItem = {
  kind: "node" | "edge";
  label: string;
  text: string | null;
};

function unique(values: string[]) {
  return [...new Set(values)];
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  制度:"ある価値観を持った人々が日常的に行う習慣をより円滑に行うために作られる制度や、日常の空間とユーザー体験を構成するビジネスを行う関係者(ビジネスエコシステム)がビジネスをより円滑に行うために作られる制度",
  日常の空間とユーザー体験:"技術や資源を動員して開発された製品・サービスによって構成される物理的空間であり、その空間で製品・サービスに対してある価値観のもとで意味付けを行い、それらを使用するユーザーの体験",
  前衛的社会問題:"技術や資源のパラダイムによって引き起こされる社会問題や日常生活が営まれる空間やそこでのユーザーの体験に対してアート(社会批評)を介して顕在化される社会問題.この問題は誰もが認識しているのではなく、ある一部の先進的/マイノリティの人々のみが認識するもの",
  社会問題: "前衛的社会問題に取り組み先進的なコミュニティによって社会に認識される社会問題やメディアを介して暴露される制度で拘束された社会問題.社会において解決すべき対象として顕在化される",
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

const MODEL_DISCIPLINES: Record<string, string[]> = {
  制度: ["政治学", "法学", "公共政策"],
  "日常の空間とユーザー体験": ["デザイン学", "HCI", "建築・都市計画"],
  前衛的社会問題: ["社会学", "文化研究", "批評理論"],
  社会問題: ["社会政策", "社会学", "公共政策"],
  "技術や資源": ["技術経営", "情報学", "イノベーション研究"],
  人々の価値観: ["心理学", "文化人類学", "倫理学"],
  ビジネスエコシステム: ["経営学", "産業組織論"],
  アート: ["芸術学", "表象文化論"],
  メディア: ["メディア論", "情報社会学"],
  コミュニティ化: ["コミュニティ研究", "社会関係資本論"],
  組織化: ["組織論", "経営学"],
  コミュニケーション: ["コミュニケーション論", "メディア論"],
  文化芸術振興: ["文化政策", "アートマネジメント"],
  標準化: ["標準化研究", "制度論"],
  意味付け: ["記号論", "消費者行動論"],
  "製品・サービス": ["サービスデザイン", "プロダクト開発"],
  製品やサービス: ["サービスデザイン", "プロダクト開発"],
  習慣化: ["行動科学", "心理学"],
  パラダイム: ["科学技術社会論", "イノベーション研究"],
};

const MODEL_HINTS: Record<string, string> = {
  "技術や資源":
    "既に存在する技術・資金・人材・データ・組織基盤のうち、このモデルを支えている具体例を挙げると書きやすくなります。",
  制度:
    "制度やルールとして定着しているものに注目し、法律・慣行・業界標準・運用ルールなどを具体例で書くと整理しやすくなります。",
  "日常の空間とユーザー体験":
    "人が日常の中で実際に触れている場面を思い浮かべ、行動・感情・使い勝手・体験の流れを具体的に書くとまとまりやすくなります。",
  "前衛的社会問題":
    "まだ主流ではないが先鋭的に現れている問題や兆候に注目し、誰に何が起き始めているのかを書くと見えやすくなります。",
  社会問題:
    "すでに社会で共有されている課題として、どの層にどんな影響が広がっているのかを具体例とともに書くと整理しやすくなります。",
  "人々の価値観":
    "人々が何を大切だと感じるのか、どんな期待や不安を持つのかに注目し、言葉や態度の変化として書くと捉えやすくなります。",
  ビジネスエコシステム:
    "企業・自治体・利用者など複数の主体がどう関わっているかを考え、役割分担や利益の流れを書くと見通しが良くなります。",
  アート:
    "表現や感性の面からどんな新しい見方を提示しているかに注目し、象徴的な作品や実践を書くと具体化しやすくなります。",
  メディア:
    "どの媒体や発信の仕組みを通じて広がっているかを考え、伝わり方や話題化のされ方を書くと整理しやすくなります。",
  コミュニティ化:
    "同じ関心を持つ人がどう集まり、支え合い、活動しているかを具体的な場やつながりとして書くと見えやすくなります。",
  組織化:
    "活動や課題がどのように役割分担され、組織として形になっているかに注目し、主体や仕組みを書くと整理しやすくなります。",
  コミュニケーション:
    "人と人のあいだで何が共有され、どう理解や行動が変わるのかに注目し、会話・発信・参加の形を書いてみてください。",
  標準化:
    "ルールや仕様が共通化されている点に注目し、どこまで合意されているのか、何が基準になっているのかを書くと整理しやすくなります。",
  文化芸術振興:
    "文化や芸術を支える仕組み・活動・支援制度に注目し、誰が何を後押ししているのかを具体的に書くと見えやすくなります。",
  パラダイム:
    "前の世代から次の世代へ、物事の見方がどう切り替わったのかに注目し、価値基準の変化として書くと整理しやすくなります。",
  "製品・サービス":
    "技術や資源がどのような製品やサービスとして形になったのかを考え、利用場面や提供価値まで書くと具体化しやすくなります。",
  意味付け:
    "人々の価値観が次の世代でどんな意味として受け取られるのかに注目し、言葉・物語・解釈の変化として書いてみてください。",
  習慣化:
    "一時的な動きではなく、繰り返されて定着した行動や運用に注目し、日常や制度の中にどう埋め込まれたかを書くと見えやすくなります。",
};

function getNormalizedText(text: string | null) {
  if (!text) return null;
  const normalized = text.trim();
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
  const updateNodeText = useSessionStore((state) => state.updateNodeText);
  const updateEdgeText = useSessionStore((state) => state.updateEdgeText);

  const selectedEntry = useMemo((): NodeEntry | EdgeEntry | null => {
    if (!session || !selectedTarget) return null;

    const generation = session.generations.find(
      (g) => g.generationIndex === selectedTarget.generation
    );
    if (!generation) return null;

    if (selectedTarget.kind === "node") {
      return generation.nodes[selectedTarget.id] ?? null;
    }

    return generation.edges[selectedTarget.id] ?? null;
  }, [session, selectedTarget]);

  const relatedModels = useMemo(() => {
    if (!session || !selectedTarget) {
      return {
        affectedNodes: [] as RelatedItem[],
        affectedEdges: [] as RelatedItem[],
        affectingNodes: [] as RelatedItem[],
        affectingEdges: [] as RelatedItem[],
      };
    }

    const generation = session.generations.find(
      (item) => item.generationIndex === selectedTarget.generation
    );

    if (!generation) {
      return {
        affectedNodes: [] as RelatedItem[],
        affectedEdges: [] as RelatedItem[],
        affectingNodes: [] as RelatedItem[],
        affectingEdges: [] as RelatedItem[],
      };
    }

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
              return node
                ? {
                    kind: "node" as const,
                    label: node.label,
                    text: getNormalizedText(node.text),
                  }
                : null;
            })
            .concat(
              incomingPrevious.map((edge) => {
                const node = previousGeneration?.nodes[edge.source];
                return node
                  ? {
                      kind: "node" as const,
                      label: node.label,
                      text: getNormalizedText(node.text),
                    }
                  : null;
              })
            )
            .filter(Boolean) as RelatedItem[]
        ),
        affectedEdges: dedupeRelatedItems(
          incomingCurrent
            .map((edge) => ({
              kind: "edge" as const,
              label: edge.label,
              text: getNormalizedText(edge.text),
            }))
            .concat(
              incomingPrevious.map((edge) => ({
                kind: "edge" as const,
                label: edge.label,
                text: getNormalizedText(edge.text),
              }))
            )
        ),
        affectingNodes: dedupeRelatedItems(
          outgoingCurrent
            .map((edge) => {
              const node = crossGenerationEdgeIds.has(edge.templateId)
                ? nextGeneration?.nodes[edge.target]
                : nodes[edge.target];

              return node
                ? {
                    kind: "node" as const,
                    label: node.label,
                    text: getNormalizedText(node.text),
                  }
                : null;
            })
            .filter(Boolean) as RelatedItem[]
        ),
        affectingEdges: dedupeRelatedItems(
          outgoingCurrent.map((edge) => ({
            kind: "edge" as const,
            label: edge.label,
            text: getNormalizedText(edge.text),
          }))
        ),
      };
    }

    const edge = generation.edges[selectedTarget.id];

    if (!edge) {
      return {
        affectedNodes: [] as RelatedItem[],
        affectedEdges: [] as RelatedItem[],
        affectingNodes: [] as RelatedItem[],
        affectingEdges: [] as RelatedItem[],
      };
    }

    return {
      affectedNodes: [] as RelatedItem[],
      affectedEdges: [] as RelatedItem[],
      affectingNodes: [] as RelatedItem[],
      affectingEdges: [] as RelatedItem[],
    };
  }, [session, selectedTarget]);

  const [inputValue, setInputValue] = useState("");
  const [isEditingConfirmedEntry, setIsEditingConfirmedEntry] = useState(false);
  const [isAssisting, setIsAssisting] = useState(false);

  useEffect(() => {
    if (selectedEntry?.text) {
      setInputValue(selectedEntry.text);
    } else {
      setInputValue("");
    }

    setIsEditingConfirmedEntry(false);
  }, [selectedEntry]);

  const handleConfirm = () => {
    if (!selectedTarget) return;

    if (selectedTarget.kind === "node") {
      updateNodeText(selectedTarget.generation, selectedTarget.id, inputValue);
      setIsEditingConfirmedEntry(false);
      return;
    }

    updateEdgeText(selectedTarget.generation, selectedTarget.id, inputValue);
    setIsEditingConfirmedEntry(false);
  };

  const handleAssist = async () => {
    if (!selectedEntry) return;

    setIsAssisting(true);

    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: selectedEntry.label,
          description: MODEL_DESCRIPTIONS[selectedEntry.label] ?? null,
          hint: MODEL_HINTS[selectedEntry.label] ?? null,
          currentText: inputValue,
          affected: [...filledAffectedNodes, ...filledAffectedEdges],
          affecting: [...filledAffectingNodes, ...filledAffectingEdges],
        }),
      });

      const data = (await response.json()) as { suggestion?: string; error?: string };

      if (!response.ok || !data.suggestion) {
        throw new Error(data.error || "Failed to get AI suggestion");
      }

      setInputValue(data.suggestion);
      setIsEditingConfirmedEntry(true);
    } catch (error) {
      console.error(error);
      alert("AIアシストの取得に失敗しました。");
    } finally {
      setIsAssisting(false);
    }
  };

  const isLocked = false;
  const isConfirmed = selectedEntry?.isConfirmed ?? false;
  const canEdit = !isLocked && (!isConfirmed || isEditingConfirmedEntry);
  const inputLength = inputValue.trim().length;
  const canConfirm = canEdit && inputLength > 0;
  const showEditor = !isConfirmed || isEditingConfirmedEntry;
  const modelDescription =
    (selectedEntry && MODEL_DESCRIPTIONS[selectedEntry.label]) ||
    "このモデルが示す対象や関係について、具体的な観察や解釈を書きます。";
  const relatedDisciplines = selectedEntry ? MODEL_DISCIPLINES[selectedEntry.label] ?? [] : [];
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
                <span className="selected-model-hint-mark" aria-hidden="true">
                  ?
                </span>
                <p className="selected-model-hint-text">{modelHint}</p>
              </div>
            )}
          </div>

          <label className="form-label">関連するもの</label>
          {selectedTarget.kind === "node" ? (
            <div className="related-model-layout">
            <div className="sub-box related-model-group-card">
              <p className="related-model-title">影響を受けるモデル</p>
              {filledAffectedNodes.length > 0 || filledAffectedEdges.length > 0 ? (
                <>
                  {filledAffectedNodes.length > 0 && (
                    <div className="related-model-subgroup">
                      <p className="related-model-subtitle">ノード</p>
                      <div className="related-model-card-list">
                        {filledAffectedNodes.map((item) => (
                          <article key={`affected-node-${item.label}`} className="related-model-card">
                            <p className="related-model-card-name">{item.label}</p>
                            <p className="related-model-card-text">
                              {item.text || "入力はまだありません。"}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                  {filledAffectedEdges.length > 0 && (
                    <div className="related-model-subgroup">
                      <p className="related-model-subtitle">エッジ</p>
                      <div className="related-model-card-list">
                        {filledAffectedEdges.map((item) => (
                          <article key={`affected-edge-${item.label}`} className="related-model-card">
                            <p className="related-model-card-name">{item.label}</p>
                            <p className="related-model-card-text">
                              {item.text || "入力はまだありません。"}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="related-model-empty">該当するモデルはまだありません。</p>
              )}
            </div>

            <div className="sub-box related-model-group-card">
              <p className="related-model-title">影響を与えるモデル</p>
              {filledAffectingNodes.length > 0 || filledAffectingEdges.length > 0 ? (
                <>
                  {filledAffectingNodes.length > 0 && (
                    <div className="related-model-subgroup">
                      <p className="related-model-subtitle">ノード</p>
                      <div className="related-model-card-list">
                        {filledAffectingNodes.map((item) => (
                          <article key={`affecting-node-${item.label}`} className="related-model-card">
                            <p className="related-model-card-name">{item.label}</p>
                            <p className="related-model-card-text">
                              {item.text || "入力はまだありません。"}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                  {filledAffectingEdges.length > 0 && (
                    <div className="related-model-subgroup">
                      <p className="related-model-subtitle">エッジ</p>
                      <div className="related-model-card-list">
                        {filledAffectingEdges.map((item) => (
                          <article key={`affecting-edge-${item.label}`} className="related-model-card">
                            <p className="related-model-card-name">{item.label}</p>
                            <p className="related-model-card-text">
                              {item.text || "入力はまだありません。"}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="related-model-empty">該当するモデルはまだありません。</p>
              )}
            </div>

            <div className="sub-box related-model-group-card">
              <p className="related-model-title">関連する学問</p>
              {relatedDisciplines.length > 0 ? (
                <div className="related-model-list">
                  {relatedDisciplines.map((label) => (
                    <span key={`discipline-${label}`} className="related-model-chip">
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="related-model-empty">関連する学問はまだ設定されていません。</p>
              )}
            </div>
            </div>
          ) : (
            <div className="related-model-layout related-model-layout-single">
              <div className="sub-box related-model-group-card">
                <p className="related-model-title">関連する学問</p>
                {relatedDisciplines.length > 0 ? (
                  <div className="related-model-list">
                    {relatedDisciplines.map((label) => (
                      <span key={`discipline-${label}`} className="related-model-chip">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="related-model-empty">関連する学問はまだ設定されていません。</p>
                )}
              </div>
            </div>
          )}

          <div className={`editor-stage ${showEditor ? "editor-stage-open" : "editor-stage-closed"}`}>
            <label className="form-label">入力欄</label>
            <textarea
              className="form-textarea"
              value={inputValue}
              disabled={!canEdit}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="ここに内容を入力"
            />
          </div>

          <p className={`input-guide ${canConfirm ? "input-guide-ready" : ""}`}>
            {isConfirmed && !isEditingConfirmedEntry
              ? ""
              : canConfirm
              ? `入力文字数: ${inputLength}文字。入力決定できます。`
              : `入力文字数: ${inputLength}文字。入力すると入力決定できます。`}
          </p>

          {isConfirmed && !isEditingConfirmedEntry && (
            <div className="confirmed-preview">
              <div className="confirmed-preview-header">
                {!isLocked && (
                  <button
                    type="button"
                    className="confirmed-edit-button"
                    onClick={() => setIsEditingConfirmedEntry(true)}
                    aria-label="入力内容を編集"
                    title="編集"
                  >
                    <svg
                      className="confirmed-edit-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 17.25V20h2.75L17.8 8.95l-2.75-2.75L4 17.25zm15.71-9.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.17 1.17 3.91 3.91 1.17-1.17z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <p className="confirmed-preview-text">{selectedEntry?.text || "内容はありません"}</p>
            </div>
          )}

          <div className="vertical-actions right-panel-actions">
            {showEditor && (
              <button
                className={canConfirm ? "button-primary" : "button-secondary"}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {isEditingConfirmedEntry ? "修正" : "入力決定"}
              </button>
            )}
            <button className="button-secondary" onClick={handleAssist} disabled={isAssisting}>
              {isAssisting ? "AI生成中..." : "AIアシスト"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
