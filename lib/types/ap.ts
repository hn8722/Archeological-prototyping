export type EntryStatus = "filled" | "empty" | "locked" | "error";

export type NodeEntry = {
  templateId: string;
  label: string;
  text: string | null;
  status: EntryStatus;
  isConfirmed: boolean;
};

export type EdgeEntry = {
  templateId: string;
  source: string;
  target: string;
  label: string;
  text: string | null;
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
  activeGeneration: number;
  generations: GenerationModel[];
};

export type SelectedTarget =
  | {
      generation: number;
      kind: "node";
      id: string;
    }
  | {
      generation: number;
      kind: "edge";
      id: string;
    }
  | null;
