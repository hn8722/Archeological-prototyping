export function getVisibleGenerationIndexes(activeGeneration: number) {
  return [activeGeneration - 1, activeGeneration, activeGeneration + 1];
}