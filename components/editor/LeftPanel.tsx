"use client";

import { useSessionStore } from "@/store/useSessionStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getFieldDefs, combineFields } from "@/lib/templates/fieldSchema";
import { NodeEntry, EdgeEntry, FieldEntry } from "@/lib/types/ap";

export function LeftPanel() {
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const setActiveGeneration = useSessionStore((state) => state.setActiveGeneration);
  const setNodeFieldEntries = useSessionStore((state) => state.setNodeFieldEntries);
  const setEdgeFieldEntries = useSessionStore((state) => state.setEdgeFieldEntries);

  if (!session) return <aside className="panel">Loading...</aside>;

  const generations = session.generations;
  const currentGeneration =
    generations.find((g) => g.generationIndex === activeGeneration) ?? generations[0];

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

  function renderNodeEntries(node: NodeEntry) {
    const isOpen = selectedNodeId === node.templateId;
    if (!isOpen) return null;

    const defs = getFieldDefs(node.label);
    const completedEntries = node.fieldEntries
      .map((e, i) => ({ entry: e, index: i }))
      .filter(({ entry }) => defs.length === 0 || defs.every((def) => Boolean(entry[def.key]?.trim())));

    const handleDelete = (entryIndex: number) => {
      const newEntries = node.fieldEntries.filter((_, i) => i !== entryIndex);
      setNodeFieldEntries(currentGeneration.generationIndex, node.templateId, newEntries);
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
          <p className="accordion-empty">まだ記述はありません。右図から追加できます。</p>
        ) : (
          completedEntries.map(({ entry, index: i }) => {
            const isEntrySelected = selectedTarget?.entryIndex === i;
            const preview = entryPreview(node.label, entry);
            return (
              <div
                key={i}
                className={`accordion-entry ${isEntrySelected ? "accordion-entry-selected" : ""}`}
              >
                <button
                  type="button"
                  className="accordion-entry-btn"
                  onClick={() =>
                    selectTarget({
                      generation: currentGeneration.generationIndex,
                      kind: "node",
                      id: node.templateId,
                      entryIndex: i,
                    })
                  }
                >
                  <span className="accordion-entry-index">#{i + 1}</span>
                  <span className="accordion-entry-preview">{preview}</span>
                </button>
                <button
                  type="button"
                  className="accordion-entry-delete"
                  onClick={() => handleDelete(i)}
                  title="削除"
                >
                  ×
                </button>
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
      if (!edge.text) return (
        <div className="accordion-body">
          <p className="accordion-empty">まだ記述はありません。右図から追加できます。</p>
        </div>
      );
      return (
        <div className="accordion-body">
          <div className="accordion-entry">
            <span className="accordion-entry-preview">{edge.text}</span>
          </div>
        </div>
      );
    }

    const completedEntries = edge.fieldEntries
      .map((e, i) => ({ entry: e, index: i }))
      .filter(({ entry }) => defs.every((def) => Boolean(entry[def.key]?.trim())));

    const handleDelete = (entryIndex: number) => {
      const newEntries = edge.fieldEntries.filter((_, i) => i !== entryIndex);
      setEdgeFieldEntries(currentGeneration.generationIndex, edge.templateId, newEntries);
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
          <p className="accordion-empty">まだ記述はありません。右図から追加できます。</p>
        ) : (
          completedEntries.map(({ entry, index: i }) => {
            const isEntrySelected = selectedTarget?.entryIndex === i;
            const preview = entryPreview(edge.label, entry);
            return (
              <div
                key={i}
                className={`accordion-entry ${isEntrySelected ? "accordion-entry-selected" : ""}`}
              >
                <button
                  type="button"
                  className="accordion-entry-btn"
                  onClick={() =>
                    selectTarget({
                      generation: currentGeneration.generationIndex,
                      kind: "edge",
                      id: edge.templateId,
                      entryIndex: i,
                    })
                  }
                >
                  <span className="accordion-entry-index">#{i + 1}</span>
                  <span className="accordion-entry-preview">{preview}</span>
                </button>
                <button
                  type="button"
                  className="accordion-entry-delete"
                  onClick={() => handleDelete(i)}
                  title="削除"
                >
                  ×
                </button>
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

      <div className="generation-tabs" role="tablist" aria-label="Generation tabs">
        {generations.map((generation) => {
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
              世代 {generation.generationIndex}
            </button>
          );
        })}
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
                  selectTarget({
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
                  selectTarget({
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
