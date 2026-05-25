"use client";

import { create } from "zustand";
import {
  EntryStatus,
  NodeEntry,
  EdgeEntry,
  SelectedTarget,
  SessionModel,
} from "@/lib/types/ap";
import { combineFields, areAllFieldsFilled } from "@/lib/templates/fieldSchema";

type SessionStore = {
  session: SessionModel | null;
  activeGeneration: number;
  selectedTarget: SelectedTarget;
  initializeSession: (session: SessionModel) => void;
  setSession: (session: SessionModel) => void;
  selectTarget: (target: SelectedTarget) => void;
  setActiveGeneration: (generation: number) => void;
  updateNodeFields: (generationIndex: number, nodeId: string, fields: Record<string, string>) => void;
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

  setSession: (session) =>
    set({
      session,
      activeGeneration: session.activeGeneration,
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

  updateNodeFields: (generationIndex: number, nodeId: string, fields: Record<string, string>) =>
    set((state) => {
      if (!state.session) return state;

      const updatedGenerations = state.session.generations.map((generation) => {
        if (generation.generationIndex !== generationIndex) return generation;

        const currentNode = generation.nodes[nodeId];
        if (!currentNode) return generation;

        const combinedText = combineFields(currentNode.label, fields);
        const nextStatus: EntryStatus = areAllFieldsFilled(currentNode.label, fields) ? "filled" : "empty";

        const updatedNode: NodeEntry = {
          ...currentNode,
          fields,
          text: combinedText || null,
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
        if (!currentEdge) return generation;

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
