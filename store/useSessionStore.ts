"use client";

import { create } from "zustand";
import {
  EntryStatus,
  NodeEntry,
  EdgeEntry,
  SelectedTarget,
  SessionModel,
} from "@/lib/types/ap";

type SessionStore = {
  session: SessionModel | null;
  activeGeneration: number;
  selectedTarget: SelectedTarget;
  initializeSession: (session: SessionModel) => void;
  selectTarget: (target: SelectedTarget) => void;
  setActiveGeneration: (generation: number) => void;
  updateNodeText: (generationIndex: number, nodeId: string, text: string) => void;
  updateEdgeText: (generationIndex: number, edgeId: string, text: string) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  activeGeneration: 0,
  selectedTarget: null,

  initializeSession: (session) =>
    set({
      session,
      activeGeneration: session.activeGeneration,
      selectedTarget: null,
    }),

  selectTarget: (target) => set({ selectedTarget: target }),

  setActiveGeneration: (generation) => set({ activeGeneration: generation }),

  updateNodeText: (generationIndex, nodeId, text) =>
    set((state) => {
      if (!state.session) return state;

      const updatedGenerations = state.session.generations.map((generation) => {
        if (generation.generationIndex !== generationIndex) return generation;

        const currentNode = generation.nodes[nodeId];
        if (!currentNode || currentNode.status === "locked") return generation;

        const nextStatus: EntryStatus = text.trim() ? "filled" : "empty";

        const updatedNode: NodeEntry = {
          ...currentNode,
          text,
          status: nextStatus,
          isConfirmed: true,
        };

        return {
          ...generation,
          nodes: {
            ...generation.nodes,
            [nodeId]: updatedNode,
          },
        };
      });

      return {
        session: {
          ...state.session,
          generations: updatedGenerations,
        },
      };
    }),

  updateEdgeText: (generationIndex, edgeId, text) =>
    set((state) => {
      if (!state.session) return state;

      const updatedGenerations = state.session.generations.map((generation) => {
        if (generation.generationIndex !== generationIndex) return generation;

        const currentEdge = generation.edges[edgeId];
        if (!currentEdge || currentEdge.status === "locked") return generation;

        const nextStatus: EntryStatus = text.trim() ? "filled" : "empty";

        const updatedEdge: EdgeEntry = {
          ...currentEdge,
          text,
          status: nextStatus,
          isConfirmed: true,
        };

        return {
          ...generation,
          edges: {
            ...generation.edges,
            [edgeId]: updatedEdge,
          },
        };
      });

      return {
        session: {
          ...state.session,
          generations: updatedGenerations,
        },
      };
    }),
}));
