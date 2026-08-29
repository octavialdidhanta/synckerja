import type { CatalogPosStatus } from "../../lib/catalogKind";
import { effectivePosStatus } from "../product-outlets/lib/effectiveProductOutlet";
import type { DefaultPriceRow } from "../types/defaultPrices";
import type { RecipeAvailability } from "@/stock-management/recipe-availability";

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
  if (
    !row.track_stock &&
    hasBaseRecipe &&
    recipeAvail?.maxServings != null &&
    recipeAvail.maxServings <= 0
  ) {
    return "sold_out";
  }
  return base;
}

export function recipeStockBadge(
  recipeAvail: RecipeAvailability | undefined,
  hasBaseRecipe: boolean,
  trackStock: boolean,
): "out" | "low" | null {
  if (trackStock || !hasBaseRecipe || !recipeAvail || recipeAvail.maxServings == null) {
    return null;
  }
  if (recipeAvail.maxServings <= 0) return "out";
  if (recipeAvail.maxServings <= 3) return "low";
  return null;
}
