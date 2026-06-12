"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowBigLeftDash, ArrowBigRightDash } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import {
  AP_CROSS_GENERATION_EDGES,
  AP_TEMPLATE_EDGES,
  AP_TEMPLATE_NODES,
} from "@/lib/templates/apTemplate";
import { EntryStatus } from "@/lib/types/ap";
import { formatGenerationLabel } from "@/lib/utils/generationLabel";
import { OnlineMember } from "@/lib/realtime/useOnlineMembers";

const MAP_WIDTH = 1320;
const MAP_HEIGHT = 620;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 86;
const EDGE_LABEL_WIDTH = 124;
const EDGE_LABEL_HEIGHT = 34;
const LEFT_EDGE_X = 2;
const RIGHT_EDGE_X = MAP_WIDTH - 2;
const CROSS_EDGE_DIAGONAL_OFFSET = 60;
const FUTURE_CROSS_EDGE_TARGET_Y: Record<string, number> = {
  cg2: 278,
  cg3: 341,
};
const FUTURE_CROSS_EDGE_TARGET_Y_FLIPPED: Record<string, number> = {
  cg2: 341,
  cg3: 278,
};
const HORIZONTAL_CROSS_EDGE_IDS = new Set(["cg1", "cg4"]);
const AP_NODE_POSITIONS_NORMAL: Record<string, { left: number; top: number }> = {
  n1: { left: 345, top: 74 },
  n2: { left: 120, top: 267 },
  n3: { left: 345, top: 460 },
  n4: { left: 570, top: 267 },
  n5: { left: 795, top: 74 },
  n6: { left: 795, top: 460 },
};
const AP_NODE_POSITIONS_FLIPPED: Record<string, { left: number; top: number }> = {
  n1: { left: 345, top: 460 },
  n2: { left: 120, top: 267 },
  n3: { left: 345, top: 74 },
  n4: { left: 570, top: 267 },
  n5: { left: 795, top: 460 },
  n6: { left: 795, top: 74 },
};

function getApNodePositions(generationIndex: number) {
  return generationIndex % 2 === 0
    ? AP_NODE_POSITIONS_FLIPPED
    : AP_NODE_POSITIONS_NORMAL;
}

type DiagramNode = {
  generationIndex: number;
  nodeId: string;
  label: string;
  status: EntryStatus;
  decade: string | null;
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
  generationIndex: number;
  edgeId: string;
  id: string;
  label: string;
  status: EntryStatus;
  isSelected: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  path: string;
  labelX: number;
  labelY: number;
  dashed: boolean;
  showLabel: boolean;
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

function getNodeAppearance(status: EntryStatus, isSelected: boolean) {
  return {
    background: status !== "filled" ? "#eef1f4" : undefined,
    borderColor:
      status === "error" ? "#d92d20" : isSelected ? "#111111" : status !== "filled" ? "#a8afb8" : undefined,
    opacity: status === "empty" ? 0.78 : 1,
    boxShadow: isSelected ? "0 0 0 3px rgba(17, 17, 17, 0.12)" : "none",
  };
}

function getLineAppearance(status: EntryStatus, isSelected: boolean) {
  return {
    stroke: status === "error" ? "#d92d20" : status === "filled" ? "#1570ef" : "#98a2b3",
    opacity: status === "empty" ? 0.55 : 1,
    strokeWidth: isSelected ? 3.5 : 2.2,
  };
}

export function CenterGraph({ collaborationPeers = [] }: { collaborationPeers?: OnlineMember[] }) {
  const session = useSessionStore((state) => state.session);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const selectTarget = useSessionStore((state) => state.selectTarget);
  const ensureGeneration = useSessionStore((state) => state.ensureGeneration);
  const [activeMapGeneration, setActiveMapGeneration] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.generations.length) return;

    const indexes = session.generations
      .map((generation) => generation.generationIndex)
      .sort((first, second) => first - second);
    const initialIndex = indexes.includes(session.activeGeneration)
      ? session.activeGeneration
      : indexes[0];

    setActiveMapGeneration((current) => {
      if (indexes.includes(session.activeGeneration)) {
        return session.activeGeneration;
      }

      if (current !== null && indexes.includes(current)) {
        return current;
      }

      return initialIndex;
    });
  }, [session]);

  const graphModel = useMemo(() => {
    if (!session || activeMapGeneration === null) return null;

    const allGenerationIndexes = session.generations
      .map((generation) => generation.generationIndex)
      .sort((first, second) => first - second);
    const mapGeneration = allGenerationIndexes.includes(activeMapGeneration)
      ? activeMapGeneration
      : allGenerationIndexes[0];
    const generationIndexes = [mapGeneration];
    const visibleGenerationSet = new Set(generationIndexes);
    const generationWidth = MAP_WIDTH;
    const width = MAP_WIDTH;
    const height = MAP_HEIGHT;

    const getGenerationLeft = (generationIndex: number) => {
      if (!generationIndexes.includes(generationIndex)) return null;

      return 0;
    };

    const getNodePosition = (generationIndex: number, templateId: string) => {
      const nodePosition = getApNodePositions(generationIndex)[templateId];
      const generationLeft = getGenerationLeft(generationIndex);

      if (!nodePosition || generationLeft === null) return null;

      const left = generationLeft + nodePosition.left;
      const top = nodePosition.top;

      return {
        left,
        top,
        centerX: left + NODE_WIDTH / 2,
        centerY: top + NODE_HEIGHT / 2,
      };
    };

    const visibleGenerations = session.generations.filter((generation) =>
      visibleGenerationSet.has(generation.generationIndex)
    );

    const nodes: DiagramNode[] = visibleGenerations.flatMap((generation) =>
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
          decade: getUxNodeDecade(nodeEntry.label, nodeEntry.fieldEntries),
          color: templateNode.color,
          isSelected,
          position,
        };
      })
    );

    const edges: DiagramEdge[] = visibleGenerations.flatMap((generation) =>
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

    const bridges: DiagramBridge[] = generationIndexes.flatMap((generationIndex) => {
      const generation = session.generations.find((item) => item.generationIndex === generationIndex);

      if (!generation) return [];

      const futureBridges = AP_CROSS_GENERATION_EDGES.flatMap<DiagramBridge>((connection) => {
        const source = getNodePosition(generationIndex, connection.source);
        const edgeEntry = generation.edges[connection.id];
        const isSelected =
          selectedTarget?.kind === "edge" &&
          selectedTarget.generation === generationIndex &&
          selectedTarget.id === connection.id;

        if (!source || !edgeEntry) return [];

        const uxPosition = getNodePosition(generationIndex, "n2");
        const futureTargetY = generationIndex % 2 === 0
          ? FUTURE_CROSS_EDGE_TARGET_Y_FLIPPED
          : FUTURE_CROSS_EDGE_TARGET_Y;
        const visibleTargetY = HORIZONTAL_CROSS_EDGE_IDS.has(connection.id)
          ? source.centerY
          : futureTargetY[connection.id] ??
            (uxPosition?.centerY ?? source.centerY) +
              (connection.id === "cg2" ? -CROSS_EDGE_DIAGONAL_OFFSET : CROSS_EDGE_DIAGONAL_OFFSET);
        const visibleTarget = {
          centerX: RIGHT_EDGE_X,
          centerY: visibleTargetY,
        };

        const start = getNodeAnchorPoint(source, visibleTarget);
        const end = {
          x: RIGHT_EDGE_X,
          y: visibleTargetY,
        };
        const x1 = start.x;
        const y1 = start.y;
        const x2 = end.x;
        const y2 = end.y;
        const labelX = (x1 + x2) / 2;
        const labelY = (y1 + y2) / 2;

        return [
          {
            generationIndex,
            edgeId: connection.id,
            id: `${generationIndex}-future-${connection.source}-${connection.target}`,
            label: connection.label,
            status: edgeEntry.status,
            isSelected,
            x1,
            y1,
            x2,
            y2,
            path: `M ${x1} ${y1} L ${x2} ${y2}`,
            labelX,
            labelY,
            dashed: true,
            showLabel: true,
          },
        ];
      });

      const pastBridges = AP_CROSS_GENERATION_EDGES.flatMap<DiagramBridge>((connection) => {
        const target = getNodePosition(generationIndex, connection.target);
        const previousGeneration = session.generations.find(
          (item) => item.generationIndex === generationIndex - 1
        );
        const edgeEntry = previousGeneration?.edges[connection.id] ?? generation.edges[connection.id];

        if (!target || !edgeEntry) return [];

        const visibleSourceY = HORIZONTAL_CROSS_EDGE_IDS.has(connection.id)
          ? target.centerY
          : target.centerY + (connection.id === "cg2" ? -CROSS_EDGE_DIAGONAL_OFFSET : CROSS_EDGE_DIAGONAL_OFFSET);
        const visibleSource = {
          centerX: LEFT_EDGE_X,
          centerY: visibleSourceY,
        };
        const end = getNodeAnchorPoint(target, visibleSource);
        const x1 = LEFT_EDGE_X;
        const y1 = visibleSourceY;
        const x2 = end.x;
        const y2 = end.y;
        const labelX = (x1 + x2) / 2;
        const labelY = (y1 + y2) / 2;

        return [
          {
            generationIndex,
            edgeId: connection.id,
            id: `${generationIndex}-past-${connection.source}-${connection.target}`,
            label: connection.label,
            status: edgeEntry.status,
            isSelected: false,
            x1,
            y1,
            x2,
            y2,
            path: `M ${x1} ${y1} L ${x2} ${y2}`,
            labelX,
            labelY,
            dashed: true,
            showLabel: false,
          },
        ];
      });

      return [...pastBridges, ...futureBridges];
    });

    return {
      allGenerationIndexes,
      generationIndexes,
      generationWidth,
      width,
      height,
      nodes,
      edges,
      bridges,
      getGenerationLeft,
      mapGeneration,
    };
  }, [activeMapGeneration, selectedTarget, session]);

  if (!session || !graphModel) {
    return <section className="panel graph-panel">Loading...</section>;
  }

  const navigateToGeneration = (generationIndex: number) => {
    setActiveMapGeneration(generationIndex);
  };

  const addFutureGeneration = () => {
    const confirmed = window.confirm("未来の世代を1つ追加しますか？");
    if (!confirmed) return;

    const maxIndex = Math.max(...graphModel.allGenerationIndexes);
    ensureGeneration(maxIndex + 1);
    setActiveMapGeneration(maxIndex + 1);
  };

  const addPastGeneration = () => {
    const confirmed = window.confirm("過去の世代を1つ追加しますか？");
    if (!confirmed) return;

    const minIndex = Math.min(...graphModel.allGenerationIndexes);
    ensureGeneration(minIndex - 1);
    setActiveMapGeneration(minIndex - 1);
  };

  const getTargetPeers = (
    kind: "node" | "edge",
    generationIndex: number,
    targetId: string
  ) =>
    collaborationPeers.filter(
      (peer) =>
        peer.selectedTarget?.kind === kind &&
        peer.selectedTarget.generation === generationIndex &&
        peer.selectedTarget.id === targetId
    );

  const getPeerPresentation = (peers: OnlineMember[]) => {
    const names = peers.map((peer) => peer.displayName).join(", ");
    const label =
      peers.length <= 1
        ? peers[0]?.displayName
        : `${peers[0].displayName} +${peers.length - 1}`;

    return {
      color: peers[0]?.color,
      label,
      names,
    };
  };

  return (
    <section className="panel graph-panel">
      <h2 className="panel-title">APマップ</h2>
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
          <button
            type="button"
            className="ap-transition-plus ap-transition-plus-left"
            onClick={() => navigateToGeneration(graphModel.mapGeneration - 1)}
            disabled={!graphModel.allGenerationIndexes.includes(graphModel.mapGeneration - 1)}
            aria-label="前の世代を見る"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="ap-transition-plus ap-transition-plus-right"
            onClick={() => navigateToGeneration(graphModel.mapGeneration + 1)}
            disabled={!graphModel.allGenerationIndexes.includes(graphModel.mapGeneration + 1)}
            aria-label="次の世代を見る"
          >
            <ChevronRight size={24} />
          </button>
          <div className="ap-add-generation-btns">
            <button
              type="button"
              className="ap-add-generation-btn"
              onClick={addPastGeneration}
              aria-label="過去の世代を追加"
            >
              <ArrowBigLeftDash size={13} />
              過去
            </button>
            <button
              type="button"
              className="ap-add-generation-btn"
              onClick={addFutureGeneration}
              aria-label="未来の世代を追加"
            >
              未来
              <ArrowBigRightDash size={13} />
            </button>
          </div>
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
              <marker
                id="generation-arrowhead-filled"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#1570ef" />
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
                  markerEnd={edge.status === "filled" ? "url(#generation-arrowhead-filled)" : "url(#generation-arrowhead)"}
                />
              );
            })}

            {graphModel.bridges.map((bridge) => {
              const appearance = getLineAppearance(bridge.status, bridge.isSelected);

              return (
                <path
                  key={bridge.id}
                  d={bridge.path}
                  stroke={appearance.stroke}
                  strokeWidth={appearance.strokeWidth}
                  opacity={appearance.opacity}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={bridge.dashed ? "8 8" : undefined}
                  markerEnd={bridge.status === "filled" ? "url(#generation-arrowhead-filled)" : "url(#generation-arrowhead)"}
                />
              );
            })}
          </svg>

          {graphModel.generationIndexes.map((generationIndex) => (
            <div
              key={generationIndex}
              className="ap-generation-badge"
              style={{
                left: `${(graphModel.getGenerationLeft(generationIndex) ?? 0) + 24}px`,
                top: "18px",
              }}
            >
              {formatGenerationLabel(generationIndex)}
            </div>
          ))}

          {graphModel.bridges.filter((bridge) => bridge.showLabel).map((bridge) => {
            const edgePeers = getTargetPeers("edge", bridge.generationIndex, bridge.edgeId);
            const peer = getPeerPresentation(edgePeers);
            const bridgeStyle = {
              left: `${bridge.labelX - EDGE_LABEL_WIDTH / 2}px`,
              top: `${bridge.labelY - EDGE_LABEL_HEIGHT / 2}px`,
              borderColor: peer.color ?? undefined,
              boxShadow: peer.color
                ? `0 0 0 2px color-mix(in srgb, ${peer.color} 24%, transparent), 0 4px 10px rgba(15, 23, 42, 0.08)`
                : undefined,
              "--peer-color": peer.color,
            } as CSSProperties;

            return (
              <button
                key={`${bridge.id}-label`}
                type="button"
                className={`ap-bridge-label ${bridge.isSelected ? "ap-edge-label-selected" : ""} ${bridge.status === "filled" ? "ap-edge-label-filled" : ""} ${edgePeers.length > 0 ? "ap-edge-label-peer-active" : ""}`}
                style={bridgeStyle}
                onClick={() =>
                  selectTarget({
                    generation: bridge.generationIndex,
                    kind: "edge",
                    id: bridge.edgeId,
                  })
                }
              >
                <span>{bridge.label}</span>
                {edgePeers.length > 0 && (
                  <span className="ap-peer-badge ap-edge-peer-badge" aria-label={`${peer.names} が表示中`}>
                    {peer.label}
                  </span>
                )}
                {edgePeers.length > 0 ? (
                  <span className="ap-peer-tooltip" aria-hidden="true">
                    {peer.names}
                  </span>
                ) : (
                  <span className="ap-hover-tooltip" aria-hidden="true">
                    {" "}
                  </span>
                )}
              </button>
            );
          })}

          {graphModel.edges.map((edge) => {
            const edgePeers = getTargetPeers("edge", edge.generationIndex, edge.edgeId);
            const peer = getPeerPresentation(edgePeers);
            const edgeStyle = {
              left: `${edge.labelX - EDGE_LABEL_WIDTH / 2}px`,
              top: `${edge.labelY - EDGE_LABEL_HEIGHT / 2}px`,
              borderColor: peer.color ?? undefined,
              boxShadow: peer.color
                ? `0 0 0 2px color-mix(in srgb, ${peer.color} 24%, transparent), 0 4px 10px rgba(15, 23, 42, 0.08)`
                : undefined,
              "--peer-color": peer.color,
            } as CSSProperties;

            return (
              <button
                key={`${edge.generationIndex}-${edge.edgeId}-label`}
                type="button"
                className={`ap-edge-label ${edge.isSelected ? "ap-edge-label-selected" : ""} ${edge.status === "filled" ? "ap-edge-label-filled" : ""} ${edgePeers.length > 0 ? "ap-edge-label-peer-active" : ""}`}
                style={edgeStyle}
                onClick={() =>
                  selectTarget({
                    generation: edge.generationIndex,
                    kind: "edge",
                    id: edge.edgeId,
                  })
                }
              >
                <span>{edge.label}</span>
                {edgePeers.length > 0 && (
                  <span className="ap-peer-badge ap-edge-peer-badge" aria-label={`${peer.names} が表示中`}>
                    {peer.label}
                  </span>
                )}
                {edgePeers.length > 0 ? (
                  <span className="ap-peer-tooltip" aria-hidden="true">
                    {peer.names}
                  </span>
                ) : (
                  <span className="ap-hover-tooltip" aria-hidden="true">
                    {" "}
                  </span>
                )}
              </button>
            );
          })}

          {graphModel.nodes.map((node) => {
            if (!node.position) return null;

            const appearance = getNodeAppearance(node.status, node.isSelected);
            const nodePeers = getTargetPeers("node", node.generationIndex, node.nodeId);
            const peer = getPeerPresentation(nodePeers);
            const nodeStyle = {
              left: `${node.position.left}px`,
              top: `${node.position.top}px`,
              background: appearance.background,
              borderColor: peer.color ?? appearance.borderColor,
              opacity: appearance.opacity,
              boxShadow: peer.color
                ? `0 0 0 3px color-mix(in srgb, ${peer.color} 22%, transparent), 0 0 18px color-mix(in srgb, ${peer.color} 24%, transparent)`
                : appearance.boxShadow,
              "--peer-color": peer.color,
            } as CSSProperties;

            return (
              <button
                key={`${node.generationIndex}-${node.nodeId}`}
                type="button"
                className={`ap-node-card ${node.isSelected ? "ap-node-card-selected" : ""} ${node.status === "filled" ? "ap-node-card-filled" : ""} ${nodePeers.length > 0 ? "ap-node-card-peer-active" : ""} ${node.generationIndex === 2 && node.nodeId === "n3" && node.status !== "filled" ? "ap-node-guide-pulse" : ""}`}
                style={nodeStyle}
                onClick={() =>
                  selectTarget({
                    generation: node.generationIndex,
                    kind: "node",
                    id: node.nodeId,
                  })
                }
              >
                {nodePeers.length > 0 && (
                  <span className="ap-peer-badge ap-node-peer-badge" aria-label={`${peer.names} が表示中`}>
                    {peer.label}
                  </span>
                )}
                <strong>{node.label}</strong>
                {node.decade && <span className="ap-node-decade">{node.decade}</span>}
                {nodePeers.length > 0 ? (
                  <span className="ap-peer-tooltip" aria-hidden="true">
                    {peer.names}
                  </span>
                ) : (
                  <span className="ap-hover-tooltip" aria-hidden="true">
                    {" "}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getUxNodeDecade(label: string, fieldEntries: Record<string, string>[]) {
  if (label !== "日常の空間とユーザー体験") return null;

  // YearPickerは "2020年" 形式で保存するため、その形式にマッチさせる
  const latestYear = [...fieldEntries]
    .reverse()
    .map((entry) => entry.when?.trim())
    .find((value): value is string => Boolean(value && /^\d{4}年$/.test(value)));

  return latestYear ?? null;
}
