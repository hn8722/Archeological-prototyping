"use client";

import { useSessionStore } from "@/store/useSessionStore";
import { getVisibleGenerationIndexes } from "@/lib/utils/generation";
import { StatusBadge } from "@/components/common/StatusBadge";

export function LeftPanel() {
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);

  if (!session) return <aside className="panel">Loading...</aside>;

  const visibleIndexes = getVisibleGenerationIndexes(activeGeneration);

  return (
    <aside className="panel">
      <h2 className="panel-title">左図: APパーツ一覧</h2>

      {visibleIndexes.map((generationIndex) => {
        const generation = session.generations.find(
          (g) => g.generationIndex === generationIndex
        );

        if (!generation) {
          return (
            <div key={generationIndex} className="generation-block generation-empty">
              世代 {generationIndex}: ...
            </div>
          );
        }

        return (
          <div key={generationIndex} className="generation-block">
            <h3 className="generation-title">世代 {generationIndex}</h3>

            <div className="sub-section-title">ノード</div>
            {Object.values(generation.nodes).map((node) => {
              const isSelected =
                selectedTarget?.kind === "node" &&
                selectedTarget.generation === generationIndex &&
                selectedTarget.id === node.templateId;

              return (
                <button
                  key={node.templateId}
                  className={`item-row ${isSelected ? "item-row-selected" : ""}`}
                  onClick={() =>
                    selectTarget({
                      generation: generationIndex,
                      kind: "node",
                      id: node.templateId,
                    })
                  }
                >
                  <span>{node.label}</span>
                  <StatusBadge status={node.status} />
                </button>
              );
            })}

            <div className="sub-section-title">エッジ</div>
            {Object.values(generation.edges).map((edge) => {
              const isSelected =
                selectedTarget?.kind === "edge" &&
                selectedTarget.generation === generationIndex &&
                selectedTarget.id === edge.templateId;

              return (
                <button
                  key={edge.templateId}
                  className={`item-row ${isSelected ? "item-row-selected" : ""}`}
                  onClick={() =>
                    selectTarget({
                      generation: generationIndex,
                      kind: "edge",
                      id: edge.templateId,
                    })
                  }
                >
                  <span>
                    {edge.label} ({edge.source} → {edge.target})
                  </span>
                  <StatusBadge status={edge.status} />
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}