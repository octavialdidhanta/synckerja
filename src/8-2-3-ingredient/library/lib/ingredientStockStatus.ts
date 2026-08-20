import { stockForOutlet, type CatalogIngredient } from "../types";

export type IngredientStockStatus = "ok" | "low" | "out" | "untracked";

export function ingredientStockStatus(
  ingredient: CatalogIngredient,
  outletId: string,
): IngredientStockStatus {
  if (!ingredient.track_inventory) return "untracked";
  const stock = stockForOutlet(ingredient, outletId);
  if (stock.in_stock <= 0) return "out";
  if (stock.alert_enabled && stock.alert_at != null && stock.in_stock <= stock.alert_at) {
    return "low";
  }
  return "ok";
}

export function formatIngredientStockQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
