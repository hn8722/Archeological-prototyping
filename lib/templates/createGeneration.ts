import { EdgeEntry, GenerationModel, NodeEntry } from "@/lib/types/ap";
import {
  AP_CROSS_GENERATION_EDGES,
  AP_TEMPLATE_EDGES,
  AP_TEMPLATE_NODES,
} from "@/lib/templates/apTemplate";

export function createGeneration(generationIndex: number): GenerationModel {
  const nodes: Record<string, NodeEntry> = {};
  const edges: Record<string, EdgeEntry> = {};

  AP_TEMPLATE_NODES.forEach((node) => {
    nodes[node.id] = {
      templateId: node.id,
      label: node.label,
      text: null,
      fieldEntries: [],
      status: "empty",
      isConfirmed: false,
    };
  });

  [...AP_TEMPLATE_EDGES, ...AP_CROSS_GENERATION_EDGES].forEach((edge) => {
    edges[edge.id] = {
      templateId: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      text: null,
      fieldEntries: [],
      status: "empty",
      isConfirmed: false,
    };
  });

  return {
    generationIndex,
    nodes,
    edges,
  };
}
