/** Recipe BOM line for one modifier option (qty consumed per selected option). */
export type ModifierOptionRecipeLine = {
  ingredientId: string;
  quantityPerOption: number;
};

/**
 * Max servings one option can support from outlet ingredient stock.
 * Returns null when there is no tracked recipe (caller should not OOS-gate).
 * Returns 0 when any required ingredient cannot cover one serving.
 */
export function maxServingsFromModifierRecipe(
  lines: ModifierOptionRecipeLine[],
  stockByIngredientId: Map<string, number>,
): number | null {
  const tracked = lines.filter(
    (l) => l.ingredientId && Number(l.quantityPerOption) > 0,
  );
  if (tracked.length === 0) return null;

  let max = Number.POSITIVE_INFINITY;
  for (const line of tracked) {
    const stock = stockByIngredientId.get(line.ingredientId);
    const qty = Number(line.quantityPerOption);
    if (!Number.isFinite(stock) || stock == null || stock < 0) {
      max = 0;
      break;
    }
    max = Math.min(max, Math.floor(stock / qty));
  }
  if (!Number.isFinite(max)) return null;
  return Math.max(0, max);
}

export function isModifierOptionOutOfStock(
  availableQty: number | null | undefined,
): boolean {
  return availableQty != null && availableQty <= 0;
}
