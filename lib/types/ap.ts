export type EntryStatus = "filled" | "empty" | "error";

export type FieldEntry = Record<string, string>;

export type NodeEntry = {
  templateId: string;
  label: string;
  text: string | null;
  fieldEntries: FieldEntry[];
  status: EntryStatus;
  isConfirmed: boolean;
};

export type EdgeEntry = {
  templateId: string;
  source: string;
  target: string;
  label: string;
  text: string | null;
  fieldEntries: FieldEntry[];
  status: EntryStatus;
  isConfirmed: boolean;
};

export type GenerationModel = {
  generationIndex: number;
  nodes: Record<string, NodeEntry>;
  edges: Record<string, EdgeEntry>;
};

export type SessionModel = {
  id: string;
  name: string;
  revision: number;
  activeGeneration: number;
  generations: GenerationModel[];
  internalMeta?: SessionInternalMeta;
};

export type ImportedEntryRecord = {
  sourceSessionId: string;
  sourceSessionName: string;
  targetKind: "node" | "edge";
  generationIndex: number;
  entryId: string;
  mode: "append" | "replace";
  importedAt: string;
};

export type SessionInternalMeta = {
  gallerySourceSessionIds?: string[];
  gallerySourceSessionNames?: string[];
  importedEntries?: ImportedEntryRecord[];
};

export type SessionPatch = {
  mutationId: string;
  sessionId: string;
  baseRevision: number;
  nextRevision: number;
  generationIndex: number;
  targetKind: "node" | "edge";
  entryId: string;
  entry: NodeEntry | EdgeEntry;
};

export type SelectedTarget =
  | {
      generation: number;
      kind: "node";
      id: string;
      entryIndex?: number;
    }
  | {
      generation: number;
      kind: "edge";
      id: string;
      entryIndex?: number;
    }
  | null;
