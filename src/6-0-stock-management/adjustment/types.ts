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
};

export type InventoryAdjustmentIngredientLine = {
  itemKind: "ingredient";
  ingredientId: string;
  ingredientName: string;
  inStock: number;
  actualStock: number;
  qtyDelta: number;
};

export type InventoryAdjustmentMovementLine = InventoryAdjustmentProductLine | InventoryAdjustmentIngredientLine;

export type InventoryAdjustmentBatch = {
  itemKind: CatalogStockItemKind;
  referenceId: string;
  occurredAt: string;
  note: string | null;
  itemsLabel: string;
  totalQtyDelta: number;
  lines: InventoryAdjustmentMovementLine[];
};

export type InventoryAdjustmentStats = {
  adjustmentsCount: number;
  itemsAdjusted: number;
  totalAdjustmentExpense: number;
  totalAdjustmentIncome: number;
};

