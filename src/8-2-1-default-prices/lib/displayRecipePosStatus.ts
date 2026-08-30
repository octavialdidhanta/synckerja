import type { CatalogPosStatus } from "./catalogKind";
import { effectivePosStatus } from "../product-outlets/lib/effectiveProductOutlet";
import type { DefaultPriceRow } from "../types/defaultPrices";
import type { RecipeAvailability } from "@/stock-management/recipe-availability";

export type ProductListStockMode = "tracked" | "menuRecipe" | "untracked";

/**
 * Display POS status for product-list: hidden > sold_out > recipe OOS > available.
 * Does not write to DB — display merge only.
 */
export function displayPosStatusForTable(
  row: Pick<DefaultPriceRow, "pos_status" | "outlet_overrides" | "track_stock">,
  outletId: string | null,
  recipeAvail: RecipeAvailability | undefined,
  hasBaseRecipe: boolean,
): CatalogPosStatus {
  const base = effectivePosStatus(row, outletId);
  if (base === "hidden" || base === "sold_out") return base;
  if (hasBaseRecipe && recipeAvail?.maxServings != null && recipeAvail.maxServings <= 0) {
    return "sold_out";
  }
  return base;
}

export function recipeStockBadge(
  recipeAvail: RecipeAvailability | undefined,
  hasBaseRecipe: boolean,
): "out" | "low" | null {
  if (!hasBaseRecipe || !recipeAvail || recipeAvail.maxServings == null) {
    return null;
  }
  if (recipeAvail.maxServings <= 0) return "out";
  if (recipeAvail.maxServings <= 3) return "low";
  return null;
}

/** Living Qty: recipe maxServings when a base recipe exists, else finished-goods qty. */
export function displayProductListQty(args: {
  hasBaseRecipe: boolean;
  maxServings: number | null | undefined;
  trackStock: boolean;
  finishedGoodsQty: number | null;
}): number | null {
  if (args.hasBaseRecipe && args.maxServings != null) {
    return args.maxServings;
  }
  if (args.trackStock) {
    return args.finishedGoodsQty ?? 0;
  }
  return null;
}

export function productListStockModeLabel(
  hasBaseRecipe: boolean,
  trackStock: boolean,
): ProductListStockMode {
  if (hasBaseRecipe) return "menuRecipe";
  if (trackStock) return "tracked";
  return "untracked";
}

export function isRecipeDrivenOutOfStock(args: {
  displayStatus: CatalogPosStatus;
  flagStatus: CatalogPosStatus;
  hasBaseRecipe: boolean;
  maxServings: number | null | undefined;
}): boolean {
  return (
    args.displayStatus === "sold_out" &&
    args.flagStatus === "available" &&
    args.hasBaseRecipe &&
    args.maxServings != null &&
    args.maxServings <= 0
  );
}

export function canStartItemInventoryTracking(hasBaseRecipe: boolean): boolean {
  return !hasBaseRecipe;
}

export function lockItemTrackingCheckbox(
  lockTracking: boolean,
  hasBaseRecipe: boolean,
): boolean {
  return lockTracking || hasBaseRecipe;
}
