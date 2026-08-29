import { isTrackedProduct } from "@/8-2-1-default-prices/lib/catalogKind";

export type ProductSalesStockMode = "retailTracked" | "recipeMenu" | "none";

/**
 * Classify how a product sale should affect stock.
 * - retailTracked: finished goods (and optional recipe) on pay
 * - recipeMenu: ingredients from base recipe only (no finished-goods qty)
 * - none: no catalog product/recipe stock effect from this flag alone
 */
export function productSalesStockMode(args: {
  kind?: string | null;
  trackStock?: boolean | null;
  hasBaseRecipe?: boolean | null;
}): ProductSalesStockMode {
  if (args.kind !== "product") return "none";
  if (isTrackedProduct(args)) return "retailTracked";
  if (args.hasBaseRecipe) return "recipeMenu";
  return "none";
}
