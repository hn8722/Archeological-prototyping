export function formatGenerationLabel(generationIndex: number) {
  if (generationIndex === 0) return "現在";
  if (generationIndex < 0) return `過去${Math.abs(generationIndex)}`;
  return `未来${generationIndex}`;
}
