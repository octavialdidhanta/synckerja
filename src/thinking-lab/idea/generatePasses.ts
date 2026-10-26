import type { IdeaGeneratePass } from "@/thinking-lab/idea/types";

export const IDEA_GENERATE_PASS_IDS = [
  "sentenceForm",
  "mechanismShape",
] as const satisfies readonly IdeaGeneratePass[];

/** Both Generate checks, or nothing. One id alone is not a pass to carry. */
export function readIdeaGeneratePasses(value: unknown): IdeaGeneratePass[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<IdeaGeneratePass>();
  for (const item of value) {
    if (item === "sentenceForm" || item === "mechanismShape") found.add(item);
  }
  return IDEA_GENERATE_PASS_IDS.every((id) => found.has(id)) ? [...IDEA_GENERATE_PASS_IDS] : [];
}
