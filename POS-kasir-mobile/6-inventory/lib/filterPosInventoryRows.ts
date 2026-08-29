import {
  ingredientStockStatus,
  type IngredientStockStatus,
} from "@/8-2-3-ingredient/library/lib/ingredientStockStatus";
import type {
  CatalogIngredient,
  CatalogIngredientKind,
} from "@/8-2-3-ingredient/library/types";

export const POS_INVENTORY_FILTER_ALL = "__all__";

export type PosInventoryKindFilter = typeof POS_INVENTORY_FILTER_ALL | CatalogIngredientKind;
export type PosInventoryStatusFilter =
  | typeof POS_INVENTORY_FILTER_ALL
  | Extract<IngredientStockStatus, "low" | "out">;

export type FilterPosInventoryRowsArgs = {
  rows: CatalogIngredient[];
  outletId: string;
  kind: PosInventoryKindFilter;
  inventoryStatus: PosInventoryStatusFilter;
  search: string;
  /** When true (default), hide ingredients that do not track inventory. */
  trackedOnly?: boolean;
};

/**
 * Client-side filter for POS inventory list.
 * Keeps stock-status logic on SSOT `ingredientStockStatus`.
 */
export function filterPosInventoryRows({
  rows,
  outletId,
  kind,
  inventoryStatus,
  search,
  trackedOnly = true,
}: FilterPosInventoryRowsArgs): CatalogIngredient[] {
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (trackedOnly && !row.track_inventory) return false;
    if (outletId && !(row.outlet_ids ?? []).includes(outletId)) return false;
    if (kind !== POS_INVENTORY_FILTER_ALL && row.kind !== kind) return false;
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (inventoryStatus !== POS_INVENTORY_FILTER_ALL) {
      const status = ingredientStockStatus(row, outletId);
      if (inventoryStatus === "low" && status !== "low") return false;
      if (inventoryStatus === "out" && status !== "out") return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
