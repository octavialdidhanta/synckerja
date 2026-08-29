import type { CommitDeltaLine } from "../computeCommitDelta";

/**
 * Kitchen commit only consumes recipes. Include any product with a base recipe
 * (including hybrid trackStock+recipe). Skip pure FG without recipe.
 */
export function filterKitchenCommitLines(
  deltas: CommitDeltaLine[],
  hasBaseRecipeSet: Set<string>,
): CommitDeltaLine[] {
  return deltas.filter((d) => hasBaseRecipeSet.has(d.line.catalogId));
}
