import { SessionModel, GenerationModel, NodeEntry, EdgeEntry } from "@/lib/types/ap";
import {
  AP_TEMPLATE_NODES,
  AP_TEMPLATE_EDGES,
  AP_CROSS_GENERATION_EDGES,
} from "@/lib/templates/apTemplate";

function createGeneration(generationIndex: number): GenerationModel {
  const nodes: Record<string, NodeEntry> = {};
  const edges: Record<string, EdgeEntry> = {};

  AP_TEMPLATE_NODES.forEach((node) => {
    nodes[node.id] = {
      templateId: node.id,
      label: node.label,
      text: null,
      fields: {},
      status: "empty",
      isConfirmed: false,
    };
  });

  AP_TEMPLATE_EDGES.forEach((edge) => {
    edges[edge.id] = {
      templateId: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      text: null,
      fields: {},
      status: "empty",
      isConfirmed: false,
    };
  });

  if (generationIndex < 3) {
    AP_CROSS_GENERATION_EDGES.forEach((edge) => {
      edges[edge.id] = {
        templateId: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        text: null,
        fields: {},
        status: "empty",
        isConfirmed: false,
      };
    });
  }

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
    activeGeneration: 1,
    generations: [1, 2, 3].map(createGeneration),
  };
}
