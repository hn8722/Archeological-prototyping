import { SessionModel } from "@/lib/types/ap";
import { createGeneration } from "@/lib/templates/createGeneration";

export function mockSession(id: string): SessionModel {
  return {
    id,
    revision: 0,
    name: "デモセッション",
    activeGeneration: 0,
    generations: [0, 1, 2].map(createGeneration),
  };
}
