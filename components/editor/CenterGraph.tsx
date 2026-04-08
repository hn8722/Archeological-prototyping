"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useSessionStore } from "@/store/useSessionStore";
import { getVisibleGenerationIndexes } from "@/lib/utils/generation";
import { AP_TEMPLATE_NODES, AP_TEMPLATE_EDGES } from "@/lib/templates/apTemplate";

function getNodeStyle(
  status: "filled" | "empty" | "locked" | "error",
  baseColor: string,
  isSelected: boolean
) {
  const border =
    status === "error"
      ? "2px solid #e53935"
      : isSelected
      ? "3px solid #111"
      : "1px solid #999";

  const opacity = status === "filled" ? 1 : status === "locked" ? 0.25 : 0.45;

  const background =
    status === "filled"
      ? baseColor
      : status === "locked"
      ? "#d9d9d9"
      : "#e5e5e5";

  return {
    borderRadius: "999px",
    padding: 12,
    border,
    background,
    opacity,
    width: 140,
    minHeight: 74,
    textAlign: "center" as const,
    whiteSpace: "pre-line" as const,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: status === "error" ? "0 0 12px rgba(229,57,53,.5)" : "none",
  };
}

function getEdgeStyle(
  status: "filled" | "empty" | "locked" | "error",
  isSelected: boolean
) {
  return {
    stroke:
      status === "error"
        ? "#e53935"
        : status === "filled"
        ? "#333"
        : "#b8b8b8",
    strokeWidth: isSelected ? 3 : 2,
    opacity: status === "filled" ? 1 : status === "locked" ? 0.2 : 0.4,
  };
}

export function CenterGraph() {
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);

  const { nodes, edges } = useMemo(() => {
    if (!session) return { nodes: [], edges: [] };

    const visibleIndexes = getVisibleGenerationIndexes(activeGeneration);
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    visibleIndexes.forEach((generationIndex, generationOffset) => {
      const generation = session.generations.find(
        (g) => g.generationIndex === generationIndex
      );

      if (!generation) return;

      const baseX = generationOffset * 860;

      AP_TEMPLATE_NODES.forEach((templateNode) => {
        const nodeEntry = generation.nodes[templateNode.id];
        const isSelected =
          selectedTarget?.kind === "node" &&
          selectedTarget.generation === generationIndex &&
          selectedTarget.id === templateNode.id;

        flowNodes.push({
          id: `${generationIndex}-${templateNode.id}`,
          data: {
            label: `${templateNode.label}\n(${generationIndex}世代)`,
          },
          position: {
            x: baseX + templateNode.x,
            y: templateNode.y,
          },
          draggable: false,
          selectable: true,
          style: getNodeStyle(
            nodeEntry.status,
            templateNode.color,
            isSelected
          ),
        });
      });

      AP_TEMPLATE_EDGES.forEach((templateEdge) => {
        const edgeEntry = generation.edges[templateEdge.id];
        const isSelected =
          selectedTarget?.kind === "edge" &&
          selectedTarget.generation === generationIndex &&
          selectedTarget.id === templateEdge.id;

        flowEdges.push({
          id: `${generationIndex}-${templateEdge.id}`,
          source: `${generationIndex}-${templateEdge.source}`,
          target: `${generationIndex}-${templateEdge.target}`,
          label: templateEdge.label,
          type: "straight",
          selectable: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: getEdgeStyle(edgeEntry.status, isSelected),
          labelStyle: {
            fill: "#444",
            fontSize: 12,
          },
        });
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [session, activeGeneration, selectedTarget]);

  return (
    <section className="panel graph-panel">
      <h2 className="panel-title">中央図: 3世代モデル図</h2>
      <div className="graph-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={(_, node) => {
            const [generation, nodeId] = node.id.split("-");
            selectTarget({
              generation: Number(generation),
              kind: "node",
              id: nodeId,
            });
          }}
          onEdgeClick={(_, edge) => {
            const [generation, edgeId] = edge.id.split("-");
            selectTarget({
              generation: Number(generation),
              kind: "edge",
              id: edgeId,
            });
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}