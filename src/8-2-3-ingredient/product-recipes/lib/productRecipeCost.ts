import { stockForOutlet, type CatalogIngredient } from "../../library/types";
import type { ProductRecipeLineDraft } from "../types";

export function lineAvgCost(
  ingredient: CatalogIngredient | undefined,
  outletId: string,
  quantity: number,
): number | null {
  if (!ingredient || !(quantity > 0)) return null;
  const stock = stockForOutlet(ingredient, outletId);
  if (!stock.track_cogs) return null;
  return quantity * stock.avg_cost;
}

export function totalAvgCost(
  lines: ProductRecipeLineDraft[],
  ingredientsById: Map<string, CatalogIngredient>,
  outletId: string,
): number {
  return lines.reduce((sum, line) => {
    const cost = lineAvgCost(ingredientsById.get(line.ingredient_id), outletId, line.quantity);
    return sum + (cost ?? 0);
  }, 0);
}

/** Recipe batch cost ÷ yield → avg cost per output unit (null if no COGS lines / invalid yield). */
export function recipeUnitAvgCost(
  lines: ProductRecipeLineDraft[],
  yieldQty: number,
  ingredientsById: Map<string, CatalogIngredient>,
  outletId: string,
): number | null {
  if (!(yieldQty > 0) || !Number.isFinite(yieldQty)) return null;
  const total = totalAvgCost(lines, ingredientsById, outletId);
  if (!(total > 0)) return null;
  return total / yieldQty;
}

export function formatRecipeCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}
