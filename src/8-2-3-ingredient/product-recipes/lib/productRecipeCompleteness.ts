import type { ProductRecipeDraft, ProductRecipeLineDraft } from "../types";

export function isProductRecipeComplete(lines: ProductRecipeLineDraft[]): boolean {
  return lines.some((line) => line.quantity > 0);
}

export function isProductRecipeDraftComplete(draft: ProductRecipeDraft | null | undefined): boolean {
  if (!draft) return false;
  return isProductRecipeComplete(draft.lines);
}

export function persistableProductRecipeLines(lines: ProductRecipeLineDraft[]): ProductRecipeLineDraft[] {
  return lines.filter((line) => line.ingredient_id && line.quantity > 0);
}
