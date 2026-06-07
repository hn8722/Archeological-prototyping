import { EdgeEntry, FieldEntry, GenerationModel, NodeEntry, SessionModel, SessionPatch } from "@/lib/types/ap";
import {
  AP_CROSS_GENERATION_EDGES,
  AP_TEMPLATE_EDGES,
  AP_TEMPLATE_NODES,
} from "@/lib/templates/apTemplate";
import { combineFieldEntries, hasAnyCompletedEntry } from "@/lib/templates/fieldSchema";

const MODEL_LABEL_ALIASES: Record<string, string> = {
  "人々の価値観": "ペルソナ",
  社会問題: "社会の目標",
};

function normalizeModelLabel(label: string) {
  return MODEL_LABEL_ALIASES[label] ?? label;
}

function normalizeNodeEntry(entry: NodeEntry): NodeEntry {
  return {
    ...entry,
    label: normalizeModelLabel(entry.label),
  };
}

function normalizeEdgeEntry(entry: EdgeEntry): EdgeEntry {
  return {
    ...entry,
    label: normalizeModelLabel(entry.label),
  };
}

function createEmptyNodeEntry(templateId: string): NodeEntry | null {
  const templateNode = AP_TEMPLATE_NODES.find((node) => node.id === templateId);
  if (!templateNode) return null;

  return normalizeNodeEntry({
    templateId: templateNode.id,
    label: templateNode.label,
    text: null,
    fieldEntries: [],
    status: "empty",
    isConfirmed: false,
  });
}

function createEmptyEdgeEntry(templateId: string): EdgeEntry | null {
  const templateEdge = [...AP_TEMPLATE_EDGES, ...AP_CROSS_GENERATION_EDGES].find(
    (edge) => edge.id === templateId
  );
  if (!templateEdge) return null;

  return normalizeEdgeEntry({
    templateId: templateEdge.id,
    source: templateEdge.source,
    target: templateEdge.target,
    label: templateEdge.label,
    text: null,
    fieldEntries: [],
    status: "empty",
    isConfirmed: false,
  });
}

function getFieldEntrySignature(entry: FieldEntry) {
  return Object.entries(entry)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function hasSameFieldEntry(entries: FieldEntry[], fieldEntry: FieldEntry) {
  const signature = getFieldEntrySignature(fieldEntry);
  if (!signature) return false;
  return entries.some((entry) => getFieldEntrySignature(entry) === signature);
}

function normalizeGeneration(generation: GenerationModel): GenerationModel {
  const nodes = { ...generation.nodes };
  const edges = { ...generation.edges };

  AP_TEMPLATE_NODES.forEach((node) => {
    nodes[node.id] = nodes[node.id]
      ? normalizeNodeEntry(nodes[node.id])
      : createEmptyNodeEntry(node.id)!;
  });

  [...AP_TEMPLATE_EDGES, ...AP_CROSS_GENERATION_EDGES].forEach((edge) => {
    edges[edge.id] = edges[edge.id]
      ? normalizeEdgeEntry(edges[edge.id])
      : createEmptyEdgeEntry(edge.id)!;
  });

  return {
    ...generation,
    nodes,
    edges,
  };
}

function appendNodeFieldEntry(node: NodeEntry, fieldEntry: FieldEntry): NodeEntry {
  const fieldEntries = hasSameFieldEntry(node.fieldEntries, fieldEntry)
    ? node.fieldEntries
    : [...node.fieldEntries, fieldEntry];
  const text = combineFieldEntries(node.label, fieldEntries);

  return normalizeNodeEntry({
    ...node,
    fieldEntries,
    text: text || null,
    status: hasAnyCompletedEntry(node.label, fieldEntries) ? "filled" : "empty",
    isConfirmed: fieldEntries.length > 0,
  });
}

function appendEdgeFieldEntry(edge: EdgeEntry, fieldEntry: FieldEntry): EdgeEntry {
  const fieldEntries = hasSameFieldEntry(edge.fieldEntries, fieldEntry)
    ? edge.fieldEntries
    : [...edge.fieldEntries, fieldEntry];
  const text = combineFieldEntries(edge.label, fieldEntries);

  return normalizeEdgeEntry({
    ...edge,
    fieldEntries,
    text: text || null,
    status: hasAnyCompletedEntry(edge.label, fieldEntries) ? "filled" : "empty",
    isConfirmed: fieldEntries.length > 0,
  });
}

function updateGenerationEntry(session: SessionModel, patch: SessionPatch) {
  if (patch.targetKind === "generation") {
    const nextGeneration = patch.entry as GenerationModel;
    const hasGeneration = session.generations.some(
      (generation) => generation.generationIndex === patch.generationIndex
    );
    const generations = hasGeneration
      ? session.generations.map((generation) =>
          generation.generationIndex === patch.generationIndex ? nextGeneration : generation
        )
      : [...session.generations, nextGeneration].sort(
          (first, second) => first.generationIndex - second.generationIndex
        );

    return {
      ...session,
      activeGeneration: patch.generationIndex,
      generations,
    };
  }

  const generations = session.generations.map((generation) => {
    if (generation.generationIndex !== patch.generationIndex) return generation;

    if (patch.targetKind === "nodeFieldEntryAppend") {
      const currentNode = generation.nodes[patch.entryId];
      if (!currentNode) return generation;

      return {
        ...generation,
        nodes: {
          ...generation.nodes,
          [patch.entryId]: appendNodeFieldEntry(currentNode, patch.entry as FieldEntry),
        },
      };
    }

    if (patch.targetKind === "edgeFieldEntryAppend") {
      const currentEdge = generation.edges[patch.entryId];
      if (!currentEdge) return generation;

      return {
        ...generation,
        edges: {
          ...generation.edges,
          [patch.entryId]: appendEdgeFieldEntry(currentEdge, patch.entry as FieldEntry),
        },
      };
    }

    if (patch.targetKind === "node") {
      return {
        ...generation,
        nodes: {
          ...generation.nodes,
          [patch.entryId]: normalizeNodeEntry(patch.entry as NodeEntry),
        },
      };
    }

    return {
      ...generation,
      edges: {
        ...generation.edges,
        [patch.entryId]: normalizeEdgeEntry(patch.entry as EdgeEntry),
      },
    };
  });

  return {
    ...session,
    generations,
  };
}

export function normalizeSession(session: SessionModel): SessionModel {
  return {
    ...session,
    revision: typeof session.revision === "number" ? session.revision : 0,
    generations: session.generations.map(normalizeGeneration),
  };
}

export function applySessionPatch(
  session: SessionModel,
  patch: SessionPatch
): SessionModel | null {
  const normalized = normalizeSession(session);

  if (normalized.id !== patch.sessionId) return null;
  if (normalized.revision > patch.nextRevision) return null;

  if (
    normalized.revision !== patch.baseRevision &&
    normalized.revision !== patch.nextRevision
  ) {
    return null;
  }

  const nextRevision =
    normalized.revision === patch.baseRevision
      ? patch.nextRevision
      : normalized.revision;

  return {
    ...updateGenerationEntry(normalized, patch),
    revision: nextRevision,
  };
}
