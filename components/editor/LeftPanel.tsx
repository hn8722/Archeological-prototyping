"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getFieldDefs, combineFields } from "@/lib/templates/fieldSchema";
import { NodeEntry, EdgeEntry, FieldEntry } from "@/lib/types/ap";
import { formatGenerationLabel } from "@/lib/utils/generationLabel";
import { OnlineMember } from "@/lib/realtime/useOnlineMembers";

export function LeftPanel({ collaborationPeers = [] }: { collaborationPeers?: OnlineMember[] }) {
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
  const currentGenerationPosition = Math.max(
    0,
    generations.findIndex((generation) => generation.generationIndex === currentGeneration.generationIndex)
  );
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

  function renderNodeEntries(node: NodeEntry) {
    const isOpen = selectedNodeId === node.templateId;
    if (!isOpen) return null;

    const defs = getFieldDefs(node.label);
    const completedEntries = node.fieldEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => defs.length === 0 || defs.every((def) => Boolean(entry[def.key]?.trim())));

    const handleDelete = (entryIndex: number) => {
      const newEntries = node.fieldEntries.filter((_, index) => index !== entryIndex);
      setNodeFieldEntries(currentGeneration.generationIndex, node.templateId, newEntries);
      setConfirmDelete(null);
      if (selectedTarget?.entryIndex === entryIndex) {
        selectTarget({
          generation: currentGeneration.generationIndex,
          kind: "node",
          id: node.templateId,
        });
      }
    };

    return (
      <div className="accordion-body">
        {completedEntries.length === 0 ? (
          <p className="accordion-empty">まだ記述はありません。中央図から追加できます。</p>
        ) : (
          completedEntries.map(({ entry, index }) => {
            const isEntrySelected = selectedTarget?.entryIndex === index;
            const editor = getEntryEditor("node", node.templateId, index);
            const preview = entryPreview(node.label, entry);
            const isPendingDelete = confirmDelete?.kind === "node" && confirmDelete.templateId === node.templateId && confirmDelete.entryIndex === index;

            return (
              <div
                key={index}
                className={`accordion-entry ${isEntrySelected ? "accordion-entry-selected" : ""} ${editor ? "accordion-entry-locked" : ""}`}
              >
                <div className="accordion-entry-main">
                  <button
                    type="button"
                    className="accordion-entry-btn"
                    onClick={() =>
                      selectTarget({
                        generation: currentGeneration.generationIndex,
                        kind: "node",
                        id: node.templateId,
                        entryIndex: index,
                        mode: editor ? "viewing" : "editing",
                      })
                    }
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
                    onClick={() => setConfirmDelete(isPendingDelete ? null : { kind: "node", templateId: node.templateId, entryIndex: index })}
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

  function renderEdgeEntries(edge: EdgeEntry) {
    const isOpen = selectedEdgeId === edge.templateId;
    if (!isOpen) return null;

    const defs = getFieldDefs(edge.label);

    if (defs.length === 0) {
      return (
        <div className="accordion-body">
          {edge.text ? (
            <div className="accordion-entry">
              <span className="accordion-entry-preview">{edge.text}</span>
            </div>
          ) : (
            <p className="accordion-empty">まだ記述はありません。中央図から追加できます。</p>
          )}
        </div>
      );
    }

    const completedEntries = edge.fieldEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => defs.every((def) => Boolean(entry[def.key]?.trim())));

    const handleDelete = (entryIndex: number) => {
      const newEntries = edge.fieldEntries.filter((_, index) => index !== entryIndex);
      setEdgeFieldEntries(currentGeneration.generationIndex, edge.templateId, newEntries);
      setConfirmDelete(null);
      if (selectedTarget?.entryIndex === entryIndex) {
        selectTarget({
          generation: currentGeneration.generationIndex,
          kind: "edge",
          id: edge.templateId,
        });
      }
    };

    return (
      <div className="accordion-body">
        {completedEntries.length === 0 ? (
          <p className="accordion-empty">まだ記述はありません。中央図から追加できます。</p>
        ) : (
          completedEntries.map(({ entry, index }) => {
            const isEntrySelected = selectedTarget?.entryIndex === index;
            const editor = getEntryEditor("edge", edge.templateId, index);
            const preview = entryPreview(edge.label, entry);
            const isPendingDelete = confirmDelete?.kind === "edge" && confirmDelete.templateId === edge.templateId && confirmDelete.entryIndex === index;

            return (
              <div
                key={index}
                className={`accordion-entry ${isEntrySelected ? "accordion-entry-selected" : ""} ${editor ? "accordion-entry-locked" : ""}`}
              >
                <div className="accordion-entry-main">
                  <button
                    type="button"
                    className="accordion-entry-btn"
                    onClick={() =>
                      selectTarget({
                        generation: currentGeneration.generationIndex,
                        kind: "edge",
                        id: edge.templateId,
                        entryIndex: index,
                        mode: editor ? "viewing" : "editing",
                      })
                    }
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
                    onClick={() => setConfirmDelete(isPendingDelete ? null : { kind: "edge", templateId: edge.templateId, entryIndex: index })}
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
        <div className="sub-section-title">Objects</div>
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
              {renderNodeEntries(node)}
            </div>
          );
        })}

        <div className="sub-section-title">Arrows</div>
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
              {renderEdgeEntries(edge)}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

