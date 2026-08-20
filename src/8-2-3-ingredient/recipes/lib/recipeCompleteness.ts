import type { RecipeDraft, RecipeLineDraft } from "../types";

export function isRecipeComplete(yieldQty: number, lines: RecipeLineDraft[]): boolean {
  if (!(yieldQty > 0)) return false;
  return lines.some((line) => line.quantity > 0);
}

export function isRecipeDraftComplete(draft: RecipeDraft | null | undefined): boolean {
  if (!draft) return false;
  return isRecipeComplete(draft.yieldQty, draft.lines);
}

export function persistableRecipeLines(lines: RecipeLineDraft[]): RecipeLineDraft[] {
  return lines.filter((line) => line.ingredient_id && line.quantity > 0);
}
