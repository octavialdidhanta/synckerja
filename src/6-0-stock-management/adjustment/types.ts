import type { CatalogStockItemKind, InventorySummaryKindFilter } from "../summary/types";

export type InventoryAdjustmentKindFilter = InventorySummaryKindFilter;

export type InventoryAdjustmentProductLine = {
  itemKind: "product";
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  inStock: number;
  actualStock: number;
  qtyDelta: number;
  /** Outlet avg cost per unit when the adjustment was recorded; null = no buy price yet. */
  unitCost: number | null;
  /** qtyDelta × unitCost in rupiah (negative = expense); null when unitCost is null. */
  value: number | null;
};

export type InventoryAdjustmentIngredientLine = {
  itemKind: "ingredient";
  ingredientId: string;
  ingredientName: string;
  inStock: number;
  actualStock: number;
  qtyDelta: number;
  unitCost: number | null;
  value: number | null;
};

export type InventoryAdjustmentMovementLine = InventoryAdjustmentProductLine | InventoryAdjustmentIngredientLine;

export type InventoryAdjustmentBatch = {
  itemKind: CatalogStockItemKind;
  referenceId: string;
  occurredAt: string;
  note: string | null;
  itemsLabel: string;
  totalQtyDelta: number;
  /** Rupiah lost from stock decreases (positive number). */
  totalExpense: number;
  /** Rupiah gained from stock increases (positive number). */
  totalIncome: number;
  /** True when at least one movement in the batch has no buy price. */
  hasMissingCost: boolean;
  lines: InventoryAdjustmentMovementLine[];
};

export type InventoryAdjustmentStats = {
  adjustmentsCount: number;
  itemsAdjusted: number;
  totalAdjustmentExpense: number;
  totalAdjustmentIncome: number;
  /** Adjusted items without a buy price (valued as nothing). */
  itemsWithoutCost: number;
};

