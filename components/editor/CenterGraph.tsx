"use client";

import { CSSProperties, useMemo } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { AP_TEMPLATE_EDGES, AP_TEMPLATE_NODES } from "@/lib/templates/apTemplate";
import { EntryStatus } from "@/lib/types/ap";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 92;
const GENERATION_GAP = 120;
const EDGE_LABEL_WIDTH = 124;
const EDGE_LABEL_HEIGHT = 34;
const DIAGRAM_PADDING_X = 96;
const DIAGRAM_PADDING_Y = 72;
const POSITION_SCALE_X = 1.18;
const POSITION_SCALE_Y = 1.28;
const GENERATION_X_OFFSETS: Record<number, number> = {
  3: -120,
};

const CROSS_GENERATION_CONNECTIONS = [
  { sourceId: "n5", targetId: "n3", label: "パラダイム" },
  { sourceId: "n5", targetId: "n2", label: "製品・サービス" },
  { sourceId: "n6", targetId: "n2", label: "意味付け" },
  { sourceId: "n6", targetId: "n1", label: "習慣化" },
] as const;

const GENERATION_POSITION_OVERRIDES: Record<number, Record<string, { x: number; y: number }>> = {
  // Generation 2 is used as a transition layer so links from both sides stay cleaner.
  2: {
    n1: { x: 220, y: 320 },
    n3: { x: 220, y: 40 },
    n5: { x: 640, y: 320 },
    n6: { x: 640, y: 40 },
  },
  // Generation 3 keeps the base order so the outgoing links from generation 2
  // arrive without creating the same crisscross pattern on the right side.
  3: {
    n1: { x: 220, y: 50 },
    n3: { x: 220, y: 310 },
    n5: { x: 640, y: 50 },
    n6: { x: 640, y: 310 },
  },
};

type DiagramNode = {
  generationIndex: number;
  nodeId: string;
  label: string;
  status: EntryStatus;
  color: string;
  isSelected: boolean;
  position: {
    left: number;
    top: number;
    centerX: number;
    centerY: number;
  } | null;
};

type DiagramEdge = {
  generationIndex: number;
  edgeId: string;
  label: string;
  status: EntryStatus;
  isSelected: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  dashed: boolean;
};

type DiagramBridge = {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  path: string;
  labelX: number;
  labelY: number;
  dashed: boolean;
};

const DASHED_EDGE_LABELS = new Set([
  "コミュニケーション",
  "アート",
  "メディア",
  "標準化",
  "パラダイム",
]);

function getNodeAnchorPoint(
  source: { centerX: number; centerY: number },
  target: { centerX: number; centerY: number }
) {
  const dx = target.centerX - source.centerX;
  const dy = target.centerY - source.centerY;
  const halfWidth = NODE_WIDTH / 2;
  const halfHeight = NODE_HEIGHT / 2;

  if (dx === 0 && dy === 0) {
    return {
      x: source.centerX,
      y: source.centerY,
    };
  }

  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: source.centerX + dx * scale,
    y: source.centerY + dy * scale,
  };
}

function getNodeAppearance(status: EntryStatus, color: string, isSelected: boolean) {
  return {
    background:
      status === "filled" ? color : status === "locked" ? "#dddddd" : "#eef1f4",
    borderColor:
      status === "error" ? "#d92d20" : isSelected ? "#111111" : "#a8afb8",
    opacity: status === "locked" ? 0.45 : status === "empty" ? 0.78 : 1,
    boxShadow: isSelected ? "0 0 0 3px rgba(17, 17, 17, 0.12)" : "none",
  };
}

function getLineAppearance(status: EntryStatus, isSelected: boolean) {
  return {
    stroke: status === "error" ? "#d92d20" : "#98a2b3",
    opacity: status === "locked" ? 0.35 : status === "empty" ? 0.55 : 1,
    strokeWidth: isSelected ? 3.5 : 2.2,
  };
}

export function CenterGraph() {
  const session = useSessionStore((state) => state.session);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);

  const graphModel = useMemo(() => {
    if (!session) return null;

    const generationIndexes = session.generations.map((generation) => generation.generationIndex);
    const templateMaxX = Math.max(...AP_TEMPLATE_NODES.map((node) => node.x * POSITION_SCALE_X));
    const templateMaxY = Math.max(...AP_TEMPLATE_NODES.map((node) => node.y * POSITION_SCALE_Y));
    const generationWidth = templateMaxX + NODE_WIDTH + DIAGRAM_PADDING_X * 2;
    const width =
      generationWidth * generationIndexes.length + GENERATION_GAP * (generationIndexes.length - 1);
    const height = templateMaxY + NODE_HEIGHT + DIAGRAM_PADDING_Y * 2;

    const getGenerationLeft = (generationIndex: number) => {
      const generationOffset = generationIndexes.indexOf(generationIndex);
      if (generationOffset < 0) return null;

      return (
        generationOffset * (generationWidth + GENERATION_GAP) +
        (GENERATION_X_OFFSETS[generationIndex] ?? 0)
      );
    };

    const getNodePosition = (generationIndex: number, templateId: string) => {
      const templateNode = AP_TEMPLATE_NODES.find((node) => node.id === templateId);
      const generationLeft = getGenerationLeft(generationIndex);

      if (!templateNode || generationLeft === null) return null;

      const positionSource =
        GENERATION_POSITION_OVERRIDES[generationIndex]?.[templateId] ?? templateNode;

      const left =
        generationLeft +
        positionSource.x * POSITION_SCALE_X +
        DIAGRAM_PADDING_X;
      const top = positionSource.y * POSITION_SCALE_Y + DIAGRAM_PADDING_Y;

      return {
        left,
        top,
        centerX: left + NODE_WIDTH / 2,
        centerY: top + NODE_HEIGHT / 2,
      };
    };

    const nodes: DiagramNode[] = session.generations.flatMap((generation) =>
      AP_TEMPLATE_NODES.map((templateNode) => {
        const nodeEntry = generation.nodes[templateNode.id];
        const position = getNodePosition(generation.generationIndex, templateNode.id);
        const isSelected =
          selectedTarget?.kind === "node" &&
          selectedTarget.generation === generation.generationIndex &&
          selectedTarget.id === templateNode.id;

        return {
          generationIndex: generation.generationIndex,
          nodeId: templateNode.id,
          label: nodeEntry.label,
          status: nodeEntry.status,
          color: templateNode.color,
          isSelected,
          position,
        };
      })
    );

    const edges: DiagramEdge[] = session.generations.flatMap((generation) =>
      AP_TEMPLATE_EDGES.flatMap<DiagramEdge>((templateEdge) => {
        const edgeEntry = generation.edges[templateEdge.id];
        const source = getNodePosition(generation.generationIndex, templateEdge.source);
        const target = getNodePosition(generation.generationIndex, templateEdge.target);
        const isSelected =
          selectedTarget?.kind === "edge" &&
          selectedTarget.generation === generation.generationIndex &&
          selectedTarget.id === templateEdge.id;

        if (!source || !target) return [];

        const start = getNodeAnchorPoint(source, target);
        const end = getNodeAnchorPoint(target, source);

        return [
          {
            generationIndex: generation.generationIndex,
            edgeId: templateEdge.id,
            label: edgeEntry.label,
            status: edgeEntry.status,
            isSelected,
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            labelX: (start.x + end.x) / 2,
            labelY: (start.y + end.y) / 2,
            dashed: DASHED_EDGE_LABELS.has(edgeEntry.label),
          },
        ];
      })
    );

    const bridges: DiagramBridge[] = generationIndexes.slice(0, -1).flatMap((generationIndex, index) => {
      const nextGenerationIndex = generationIndexes[index + 1];

      return CROSS_GENERATION_CONNECTIONS.flatMap<DiagramBridge>((connection, connectionIndex) => {
        const source = getNodePosition(generationIndex, connection.sourceId);
        const target = getNodePosition(nextGenerationIndex, connection.targetId);

        if (!source || !target) return [];

        const start = getNodeAnchorPoint(source, target);
        const end = getNodeAnchorPoint(target, source);
        const x1 = start.x;
        const y1 = start.y;
        const x2 = end.x;
        const y2 = end.y;
        const labelX = (x1 + x2) / 2;
        const labelY = (y1 + y2) / 2 + (connectionIndex % 2 === 0 ? -18 : 18);

        return [
          {
            id: `${generationIndex}-${nextGenerationIndex}-${connection.sourceId}-${connection.targetId}`,
            label: connection.label,
            x1,
            y1,
            x2,
            y2,
            path: `M ${x1} ${y1} L ${x2} ${y2}`,
            labelX,
            labelY,
            dashed: DASHED_EDGE_LABELS.has(connection.label),
          },
        ];
      });
    });

    return { generationIndexes, generationWidth, width, height, nodes, edges, bridges, getGenerationLeft };
  }, [selectedTarget, session]);

  if (!session || !graphModel) {
    return <section className="panel graph-panel">Loading...</section>;
  }

  return (
    <section className="panel graph-panel">
      <h2 className="panel-title">上図: 3世代連結APマップ</h2>
      <div className="ap-map-wrapper">
        <div
          className="ap-map-canvas"
          style={
            {
              "--ap-map-width": `${graphModel.width}px`,
              "--ap-map-height": `${graphModel.height}px`,
            } as CSSProperties
          }
        >
          <svg
            className="ap-map-svg"
            viewBox={`0 0 ${graphModel.width} ${graphModel.height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="generation-arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#98a2b3" />
              </marker>
            </defs>

            {graphModel.edges.map((edge) => {
              const appearance = getLineAppearance(edge.status, edge.isSelected);

              return (
                <line
                  key={`${edge.generationIndex}-${edge.edgeId}`}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke={appearance.stroke}
                  strokeWidth={appearance.strokeWidth}
                  opacity={appearance.opacity}
                  strokeLinecap="round"
                  strokeDasharray={edge.dashed ? "8 8" : undefined}
                  markerEnd="url(#generation-arrowhead)"
                />
              );
            })}

            {graphModel.bridges.map((bridge) => (
              <path
                key={bridge.id}
                d={bridge.path}
                stroke="#98a2b3"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={bridge.dashed ? "8 8" : undefined}
                markerEnd="url(#generation-arrowhead)"
              />
            ))}
          </svg>

          {graphModel.generationIndexes.map((generationIndex, index) => (
            <div
              key={generationIndex}
              className="ap-generation-badge"
              style={{
                left: `${(graphModel.getGenerationLeft(generationIndex) ?? 0) + 24}px`,
                top: "18px",
              }}
            >
              Generation {generationIndex}
            </div>
          ))}

          {graphModel.bridges.map((bridge) => (
            <div
              key={`${bridge.id}-label`}
              className="ap-bridge-label"
              style={{
                left: `${bridge.labelX - 82}px`,
                top: `${bridge.labelY - 14}px`,
              }}
            >
              {bridge.label}
            </div>
          ))}

          {graphModel.edges.map((edge) => (
            <button
              key={`${edge.generationIndex}-${edge.edgeId}-label`}
              type="button"
              className={`ap-edge-label ${edge.isSelected ? "ap-edge-label-selected" : ""}`}
              style={{
                left: `${edge.labelX - EDGE_LABEL_WIDTH / 2}px`,
                top: `${edge.labelY - EDGE_LABEL_HEIGHT / 2}px`,
              }}
              onClick={() =>
                selectTarget({
                  generation: edge.generationIndex,
                  kind: "edge",
                  id: edge.edgeId,
                })
              }
            >
              <span>{edge.label}</span>
            </button>
          ))}

          {graphModel.nodes.map((node) => {
            if (!node.position) return null;

            const appearance = getNodeAppearance(node.status, node.color, node.isSelected);

            return (
              <button
                key={`${node.generationIndex}-${node.nodeId}`}
                type="button"
                className={`ap-node-card ${node.isSelected ? "ap-node-card-selected" : ""}`}
                style={{
                  left: `${node.position.left}px`,
                  top: `${node.position.top}px`,
                  background: appearance.background,
                  borderColor: appearance.borderColor,
                  opacity: appearance.opacity,
                  boxShadow: appearance.boxShadow,
                }}
                onClick={() =>
                  selectTarget({
                    generation: node.generationIndex,
                    kind: "node",
                    id: node.nodeId,
                  })
                }
              >
                <strong>{node.label}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
