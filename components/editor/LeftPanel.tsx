"use client";

import { useSessionStore } from "@/store/useSessionStore";
import { StatusBadge } from "@/components/common/StatusBadge";

function getDisplayText(text: string | null) {
  if (!text) return null;
  return text.trim() || null;
}

export function LeftPanel() {
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const setActiveGeneration = useSessionStore((state) => state.setActiveGeneration);

  if (!session) return <aside className="panel">Loading...</aside>;

  const generations = session.generations;
  const currentGeneration =
    generations.find((generation) => generation.generationIndex === activeGeneration) ??
    generations[0];

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
          const isSelected =
            selectedTarget?.kind === "node" &&
            selectedTarget.generation === currentGeneration.generationIndex &&
            selectedTarget.id === node.templateId;

          return (
            <button
              key={node.templateId}
              className={`item-row ${isSelected ? "item-row-selected" : ""}`}
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
                {getDisplayText(node.text) && (
                  <span className="item-row-preview">{getDisplayText(node.text)}</span>
                )}
              </span>
              <StatusBadge status={node.status} />
            </button>
          );
        })}

        <div className="sub-section-title">Arrows</div>
        {Object.values(currentGeneration.edges).map((edge) => {
          const isSelected =
            selectedTarget?.kind === "edge" &&
            selectedTarget.generation === currentGeneration.generationIndex &&
            selectedTarget.id === edge.templateId;

          return (
            <button
              key={edge.templateId}
              className={`item-row ${isSelected ? "item-row-selected" : ""}`}
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
                {getDisplayText(edge.text) && (
                  <span className="item-row-preview">{getDisplayText(edge.text)}</span>
                )}
              </span>
              <StatusBadge status={edge.status} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
