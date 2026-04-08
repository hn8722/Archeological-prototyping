import { SessionModel, GenerationModel, NodeEntry, EdgeEntry } from "@/lib/types/ap";
import { AP_TEMPLATE_NODES, AP_TEMPLATE_EDGES } from "@/lib/templates/apTemplate";

function createGeneration(generationIndex: number): GenerationModel {
  const nodes: Record<string, NodeEntry> = {};
  const edges: Record<string, EdgeEntry> = {};

  AP_TEMPLATE_NODES.forEach((node) => {
    let status: NodeEntry["status"] = "empty";
    let text: string | null = null;

    if (generationIndex === 2 && (node.id === "n1" || node.id === "n2")) {
      status = "filled";
      text = `${node.label} に関する入力済みテキスト`;
    }

    if (generationIndex === 1 && (node.id === "n5" || node.id === "n6")) {
      status = "locked";
    }

    nodes[node.id] = {
      templateId: node.id,
      label: node.label,
      text,
      status,
    };
  });

  AP_TEMPLATE_EDGES.forEach((edge) => {
    let status: EdgeEntry["status"] = "empty";
    let text: string | null = null;

    if (generationIndex === 2 && (edge.id === "e3" || edge.id === "e4")) {
      status = "filled";
      text = `${edge.label} に関する入力済みテキスト`;
    }

    if (generationIndex === 1 && (edge.id === "e7" || edge.id === "e8")) {
      status = "locked";
    }

    edges[edge.id] = {
      templateId: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      text,
      status,
    };
  });

  return {
    generationIndex,
    nodes,
    edges,
  };
}

export function mockSession(id: string): SessionModel {
  return {
    id,
    name: "デモセッション",
    activeGeneration: 2,
    generations: [1, 2, 3].map(createGeneration),
  };
}