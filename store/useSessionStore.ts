"use client";

import { create } from "zustand";
import {
  EdgeEntry,
  EntryStatus,
  FieldEntry,
  GenerationModel,
  NodeEntry,
  SelectedTarget,
  SessionModel,
  SessionPatch,
} from "@/lib/types/ap";
import { combineFieldEntries, hasAnyCompletedEntry } from "@/lib/templates/fieldSchema";
import { applySessionPatch, normalizeSession } from "@/lib/session/patch";
import { createGeneration } from "@/lib/templates/createGeneration";

function createMutationId() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function buildPatch(
  session: SessionModel,
  targetKind: "node" | "edge",
  generationIndex: number,
  entryId: string,
  entry: NodeEntry | EdgeEntry,
  entryIndex?: number
): SessionPatch {
  return {
    mutationId: createMutationId(),
    sessionId: session.id,
    baseRevision: session.revision,
    nextRevision: session.revision + 1,
    generationIndex,
    targetKind,
    entryId,
    entryIndex,
    entry,
  };
}

function buildGenerationPatch(
  session: SessionModel,
  generationIndex: number,
  generation: GenerationModel
): SessionPatch {
  return {
    mutationId: createMutationId(),
    sessionId: session.id,
    baseRevision: session.revision,
    nextRevision: session.revision + 1,
    generationIndex,
    targetKind: "generation",
    entryId: String(generationIndex),
    entry: generation,
  };
}

function buildAppendFieldEntryPatch(
  session: SessionModel,
  targetKind: "nodeFieldEntryAppend" | "edgeFieldEntryAppend",
  generationIndex: number,
  entryId: string,
  fieldEntry: FieldEntry
): SessionPatch {
  return {
    mutationId: createMutationId(),
    sessionId: session.id,
    baseRevision: session.revision,
    nextRevision: session.revision + 1,
    generationIndex,
    targetKind,
    entryId,
    entry: fieldEntry,
  };
}

function applyFieldEntriesUpdate(
  state: { session: SessionModel | null; lastMutation: SessionPatch | null },
  kind: "node" | "edge",
  generationIndex: number,
  entryId: string,
  fieldEntries: FieldEntry[],
  entryIndex?: number
) {
  if (!state.session) return state;

  const session = normalizeSession(state.session);
  const generation = session.generations.find((item) => item.generationIndex === generationIndex);
  const current = kind === "node" ? generation?.nodes[entryId] : generation?.edges[entryId];
  if (!generation || !current) return state;

  const combinedText = combineFieldEntries(current.label, fieldEntries);
  const nextStatus: EntryStatus = hasAnyCompletedEntry(current.label, fieldEntries) ? "filled" : "empty";
  const updated = {
    ...current,
    fieldEntries,
    text: combinedText || null,
    status: nextStatus,
    isConfirmed: fieldEntries.length > 0,
  } as NodeEntry | EdgeEntry;

  const patch = buildPatch(session, kind, generationIndex, entryId, updated, entryIndex);
  const nextSession = applySessionPatch(session, patch);
  if (!nextSession) return state;

  return { session: nextSession, lastMutation: patch };
}

type SessionStore = {
  session: SessionModel | null;
  lastMutation: SessionPatch | null;
  activeGeneration: number;
  selectedTarget: SelectedTarget;
  initializeSession: (session: SessionModel) => void;
  setSession: (session: SessionModel) => void;
  applyRemotePatch: (patch: SessionPatch) => void;
  selectTarget: (target: SelectedTarget) => void;
  setActiveGeneration: (generation: number) => void;
  ensureGeneration: (generation: number) => void;
  appendNodeFieldEntry: (generationIndex: number, nodeId: string, fieldEntry: FieldEntry) => void;
  appendEdgeFieldEntry: (generationIndex: number, edgeId: string, fieldEntry: FieldEntry) => void;
  setNodeFieldEntries: (generationIndex: number, nodeId: string, fieldEntries: FieldEntry[]) => void;
  setEdgeFieldEntries: (generationIndex: number, edgeId: string, fieldEntries: FieldEntry[]) => void;
  updateNodeFieldEntry: (generationIndex: number, nodeId: string, entryIndex: number, fieldEntry: FieldEntry) => void;
  updateEdgeFieldEntry: (generationIndex: number, edgeId: string, entryIndex: number, fieldEntry: FieldEntry) => void;
  updateEdgeText: (generationIndex: number, edgeId: string, text: string) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  lastMutation: null,
  activeGeneration: 0,
  selectedTarget: null,

  initializeSession: (session) =>
    set({
      session: normalizeSession(session),
      lastMutation: null,
      activeGeneration: session.activeGeneration,
      selectedTarget: null,
    }),

  setSession: (session) =>
    set((state) => ({
      session: normalizeSession({
        ...session,
        activeGeneration: state.activeGeneration,
      }),
    })),

  applyRemotePatch: (patch) =>
    set((state) => {
      if (!state.session) return state;

      const nextSession = applySessionPatch(state.session, patch);
      if (!nextSession) return state;

      return {
        session: nextSession,
      };
    }),

  selectTarget: (target) =>
    set((state) => ({
      selectedTarget: target,
      activeGeneration: target ? target.generation : state.activeGeneration,
      session: state.session
        ? {
            ...state.session,
            activeGeneration: target ? target.generation : state.activeGeneration,
          }
        : null,
    })),

  setActiveGeneration: (generation) =>
    set((state) => ({
      activeGeneration: generation,
      session: state.session
        ? {
            ...state.session,
            activeGeneration: generation,
          }
        : null,
    })),

  ensureGeneration: (generationIndex) =>
    set((state) => {
      if (!state.session) return state;

      const session = normalizeSession(state.session);
      const existingGeneration = session.generations.find(
        (generation) => generation.generationIndex === generationIndex
      );

      if (existingGeneration) {
        return {
          activeGeneration: generationIndex,
          selectedTarget: null,
          session: {
            ...session,
            activeGeneration: generationIndex,
          },
        };
      }

      const nextGeneration = createGeneration(generationIndex);
      const patch = buildGenerationPatch(session, generationIndex, nextGeneration);
      const nextSession = applySessionPatch(session, patch);
      if (!nextSession) return state;

      return {
        activeGeneration: generationIndex,
        selectedTarget: null,
        session: nextSession,
        lastMutation: patch,
      };
    }),

  appendNodeFieldEntry: (generationIndex, nodeId, fieldEntry) =>
    set((state) => {
      if (!state.session) return state;

      const session = normalizeSession(state.session);
      const patch = buildAppendFieldEntryPatch(
        session,
        "nodeFieldEntryAppend",
        generationIndex,
        nodeId,
        fieldEntry
      );
      const nextSession = applySessionPatch(session, patch);
      if (!nextSession) return state;

      return {
        session: nextSession,
        lastMutation: patch,
      };
    }),

  appendEdgeFieldEntry: (generationIndex, edgeId, fieldEntry) =>
    set((state) => {
      if (!state.session) return state;

      const session = normalizeSession(state.session);
      const patch = buildAppendFieldEntryPatch(
        session,
        "edgeFieldEntryAppend",
        generationIndex,
        edgeId,
        fieldEntry
      );
      const nextSession = applySessionPatch(session, patch);
      if (!nextSession) return state;

      return {
        session: nextSession,
        lastMutation: patch,
      };
    }),

  setNodeFieldEntries: (generationIndex, nodeId, fieldEntries) =>
    set((state) => applyFieldEntriesUpdate(state, "node", generationIndex, nodeId, fieldEntries)),

  setEdgeFieldEntries: (generationIndex, edgeId, fieldEntries) =>
    set((state) => applyFieldEntriesUpdate(state, "edge", generationIndex, edgeId, fieldEntries)),

  updateNodeFieldEntry: (generationIndex, nodeId, entryIndex, fieldEntry) =>
    set((state) => {
      if (!state.session) return state;
      const generation = state.session.generations.find((item) => item.generationIndex === generationIndex);
      const current = generation?.nodes[nodeId];
      if (!current?.fieldEntries[entryIndex]) return state;
      const nextEntries = current.fieldEntries.map((entry, index) =>
        index === entryIndex ? fieldEntry : entry
      );
      return applyFieldEntriesUpdate(state, "node", generationIndex, nodeId, nextEntries, entryIndex);
    }),

  updateEdgeFieldEntry: (generationIndex, edgeId, entryIndex, fieldEntry) =>
    set((state) => {
      if (!state.session) return state;
      const generation = state.session.generations.find((item) => item.generationIndex === generationIndex);
      const current = generation?.edges[edgeId];
      if (!current?.fieldEntries[entryIndex]) return state;
      const nextEntries = current.fieldEntries.map((entry, index) =>
        index === entryIndex ? fieldEntry : entry
      );
      return applyFieldEntriesUpdate(state, "edge", generationIndex, edgeId, nextEntries, entryIndex);
    }),

  updateEdgeText: (generationIndex, edgeId, text) =>
    set((state) => {
      if (!state.session) return state;

      const session = normalizeSession(state.session);
      const generation = session.generations.find((item) => item.generationIndex === generationIndex);
      const currentEdge = generation?.edges[edgeId];

      if (!generation || !currentEdge) return state;

      const nextStatus: EntryStatus = text.trim() ? "filled" : "empty";

      const updatedEdge: EdgeEntry = {
        ...currentEdge,
        text,
        status: nextStatus,
        isConfirmed: true,
      };

      const patch = buildPatch(session, "edge", generationIndex, edgeId, updatedEdge);
      const nextSession = applySessionPatch(session, patch);
      if (!nextSession) return state;

      return {
        session: nextSession,
        lastMutation: patch,
      };
    }),
}));
