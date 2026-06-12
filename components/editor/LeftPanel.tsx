"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getFieldDefs, combineFields } from "@/lib/templates/fieldSchema";
import { NodeEntry, EdgeEntry, FieldEntry } from "@/lib/types/ap";
import { formatGenerationLabel } from "@/lib/utils/generationLabel";
import { OnlineMember } from "@/lib/realtime/useOnlineMembers";

export function LeftPanel({ sessionId, collaborationPeers = [] }: { sessionId: string; collaborationPeers?: OnlineMember[] }) {
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const setActiveGeneration = useSessionStore((state) => state.setActiveGeneration);
  const setNodeFieldEntries = useSessionStore((state) => state.setNodeFieldEntries);
  const setEdgeFieldEntries = useSessionStore((state) => state.setEdgeFieldEntries);
  const [generationTabStart, setGenerationTabStart] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "node" | "edge"; templateId: string; entryIndex: number } | null>(null);

  useEffect(() => {
    if (!session?.generations.length) return;

    const sortedGenerations = [...session.generations].sort(
      (first, second) => first.generationIndex - second.generationIndex
    );
    const activePosition = sortedGenerations.findIndex(
      (generation) => generation.generationIndex === activeGeneration
    );
    const maxStart = Math.max(sortedGenerations.length - 3, 0);

    if (activePosition < 0) {
      setGenerationTabStart((current) => Math.min(current, maxStart));
      return;
    }

    setGenerationTabStart((current) => {
      const clampedCurrent = Math.min(current, maxStart);
      if (activePosition >= clampedCurrent && activePosition < clampedCurrent + 3) {
        return clampedCurrent;
      }

      return Math.min(Math.max(activePosition - 1, 0), maxStart);
    });
  }, [activeGeneration, session]);

  if (!session) return <aside className="panel">Loading...</aside>;

  const generations = [...session.generations].sort(
    (first, second) => first.generationIndex - second.generationIndex
  );
  const currentGeneration =
    generations.find((g) => g.generationIndex === activeGeneration) ?? generations[0];
  const maxVisibleGenerationStart = Math.max(generations.length - 3, 0);
  const visibleGenerationStart = Math.min(generationTabStart, maxVisibleGenerationStart);
  const visibleGenerations = generations.slice(visibleGenerationStart, visibleGenerationStart + 3);
  const hasPreviousGenerations = visibleGenerationStart > 0;
  const hasNextGenerations = visibleGenerationStart + visibleGenerations.length < generations.length;

  const selectedNodeId =
    selectedTarget?.kind === "node" &&
    selectedTarget.generation === currentGeneration.generationIndex
      ? selectedTarget.id
      : null;

  const selectedEdgeId =
    selectedTarget?.kind === "edge" &&
    selectedTarget.generation === currentGeneration.generationIndex
      ? selectedTarget.id
      : null;

  function entryPreview(label: string, entry: FieldEntry): string {
    return combineFields(label, entry);
  }

  function getEntryEditor(
    kind: "node" | "edge",
    entryId: string,
    entryIndex: number
  ) {
    return collaborationPeers.find((member) => {
      const target = member.selectedTarget;
      return Boolean(
        target &&
          target.mode === "editing" &&
          target.kind === kind &&
          target.generation === currentGeneration.generationIndex &&
          target.id === entryId &&
          target.entryIndex === entryIndex
      );
    });
  }

  async function acquireEntryLock(
    kind: "node" | "edge",
    entryId: string,
    entryIndex: number
  ) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/locks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: {
            generation: currentGeneration.generationIndex,
            kind,
            entryId,
            entryIndex,
          },
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function renderEntries(entry: NodeEntry | EdgeEntry, kind: "node" | "edge") {
    const isOpen = kind === "node" ? selectedNodeId === entry.templateId : selectedEdgeId === entry.templateId;
    if (!isOpen) return null;

    const defs = getFieldDefs(entry.label);

    // フリーテキスト形式のエッジ（フィールドスキーマなし）
    if (kind === "edge" && defs.length === 0) {
      return (
        <div className="accordion-body">
          {entry.text ? (
            <div className="accordion-entry">
              <span className="accordion-entry-preview">{entry.text}</span>
            </div>
          ) : (
            <p className="accordion-empty">まだ記述はありません。中央図から追加できます。</p>
          )}
        </div>
      );
    }

    const completedEntries = entry.fieldEntries
      .map((fe, index) => ({ entry: fe, index }))
      .filter(({ entry: fe }) => defs.length === 0 || defs.every((def) => Boolean(fe[def.key]?.trim())));

    const handleDelete = (entryIndex: number) => {
      const newEntries = entry.fieldEntries.filter((_, i) => i !== entryIndex);
      if (kind === "node") {
        setNodeFieldEntries(currentGeneration.generationIndex, entry.templateId, newEntries);
      } else {
        setEdgeFieldEntries(currentGeneration.generationIndex, entry.templateId, newEntries);
      }
      setConfirmDelete(null);
      if (selectedTarget?.entryIndex === entryIndex) {
        selectTarget({ generation: currentGeneration.generationIndex, kind, id: entry.templateId });
      }
    };

    return (
      <div className="accordion-body">
        {completedEntries.length === 0 ? (
          <p className="accordion-empty">まだ記述はありません。中央図から追加できます。</p>
        ) : (
          completedEntries.map(({ entry: fe, index }) => {
            const isEntrySelected = selectedTarget?.entryIndex === index;
            const editor = getEntryEditor(kind, entry.templateId, index);
            const preview = entryPreview(entry.label, fe);
            const isPendingDelete =
              confirmDelete?.kind === kind &&
              confirmDelete.templateId === entry.templateId &&
              confirmDelete.entryIndex === index;

            return (
              <div
                key={index}
                className={`accordion-entry ${isEntrySelected ? "accordion-entry-selected" : ""} ${editor ? "accordion-entry-locked" : ""}`}
              >
                <div className="accordion-entry-main">
                  <button
                    type="button"
                    className="accordion-entry-btn"
                    onClick={async () => {
                      const canEdit = editor
                        ? false
                        : await acquireEntryLock(kind, entry.templateId, index);
                      selectTarget({
                        generation: currentGeneration.generationIndex,
                        kind,
                        id: entry.templateId,
                        entryIndex: index,
                        mode: canEdit ? "editing" : "viewing",
                      });
                    }}
                  >
                    <span className="accordion-entry-index">#{index + 1}</span>
                    <span className="accordion-entry-preview">{preview}</span>
                    {editor && (
                      <span className="accordion-entry-lock">{editor.displayName} が編集中</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="accordion-entry-delete"
                    onClick={() =>
                      setConfirmDelete(
                        isPendingDelete ? null : { kind, templateId: entry.templateId, entryIndex: index }
                      )
                    }
                    disabled={Boolean(editor)}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
                {isPendingDelete && (
                  <div className="accordion-delete-confirm">
                    <span className="accordion-delete-confirm-text">削除しますか？</span>
                    <button type="button" className="accordion-delete-confirm-ok" onClick={() => handleDelete(index)}>削除</button>
                    <button type="button" className="accordion-delete-confirm-cancel" onClick={() => setConfirmDelete(null)}>キャンセル</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }
  return (
    <aside className="panel">
      <h2 className="panel-title">APパーツ一覧</h2>

      <div className="generation-tab-strip">
        <button
          type="button"
          className="generation-tab-nav"
          disabled={!hasPreviousGenerations}
          onClick={() => setGenerationTabStart((current) => Math.max(current - 3, 0))}
          aria-label="前の世代を見る"
        >
          &#8249;
        </button>
        <div className="generation-tabs" role="tablist" aria-label="Generation tabs">
          {visibleGenerations.map((generation) => {
            const isActive = generation.generationIndex === currentGeneration.generationIndex;
            return (
              <button
                key={generation.generationIndex}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`generation-tab ${isActive ? "generation-tab-active" : ""}`}
                onClick={() => setActiveGeneration(generation.generationIndex)}
              >
                <Layers size={11} />
                {formatGenerationLabel(generation.generationIndex)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="generation-tab-nav"
          disabled={!hasNextGenerations}
          onClick={() =>
            setGenerationTabStart((current) => Math.min(current + 3, maxVisibleGenerationStart))
          }
          aria-label="次の世代を見る"
        >
          &#8250;
        </button>
      </div>

      <div className="generation-block">
        <div className="sub-section-title">ノード（要素）</div>
        {Object.values(currentGeneration.nodes).map((node) => {
          const isOpen = selectedNodeId === node.templateId;

          return (
            <div key={node.templateId} className={`accordion-item ${isOpen ? "accordion-item-open" : ""}`}>
              <button
                className={`item-row ${isOpen ? "item-row-selected" : ""}`}
                onClick={() =>
                  isOpen
                    ? selectTarget(null)
                    : selectTarget({
                        generation: currentGeneration.generationIndex,
                        kind: "node",
                        id: node.templateId,
                      })
                }
              >
                <span className="item-row-content">
                  <span>{node.label}</span>
                </span>
                <StatusBadge status={node.status} />
              </button>
              {renderEntries(node, "node")}
            </div>
          );
        })}

        <div className="sub-section-title">エッジ（矢印）</div>
        {Object.values(currentGeneration.edges).map((edge) => {
          const isOpen = selectedEdgeId === edge.templateId;

          return (
            <div key={edge.templateId} className={`accordion-item ${isOpen ? "accordion-item-open" : ""}`}>
              <button
                className={`item-row ${isOpen ? "item-row-selected" : ""}`}
                onClick={() =>
                  isOpen
                    ? selectTarget(null)
                    : selectTarget({
                        generation: currentGeneration.generationIndex,
                        kind: "edge",
                        id: edge.templateId,
                      })
                }
              >
                <span className="item-row-content">
                  <span>{edge.label}</span>
                </span>
                <StatusBadge status={edge.status} />
              </button>
              {renderEntries(edge, "edge")}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
