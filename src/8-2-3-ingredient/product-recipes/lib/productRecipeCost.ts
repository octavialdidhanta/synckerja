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

export function formatRecipeCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}
