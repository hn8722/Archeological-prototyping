import { EdgeEntry, NodeEntry, SessionModel, SessionPatch } from "@/lib/types/ap";

const MODEL_LABEL_ALIASES: Record<string, string> = {
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

function updateGenerationEntry(session: SessionModel, patch: SessionPatch) {
  const generations = session.generations.map((generation) => {
    if (generation.generationIndex !== patch.generationIndex) return generation;

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
    generations: session.generations.map((generation) => ({
      ...generation,
      nodes: Object.fromEntries(
        Object.entries(generation.nodes).map(([id, entry]) => [id, normalizeNodeEntry(entry)])
      ),
      edges: Object.fromEntries(
        Object.entries(generation.edges).map(([id, entry]) => [id, normalizeEdgeEntry(entry)])
      ),
    })),
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
