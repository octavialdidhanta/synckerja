export type CatalogStockItemKind = "product" | "ingredient";

export type CatalogStockMovementType =
  | "opening"
  | "purchase_order"
  | "sale"
  | "transfer"
  | "adjustment"
  | "recipe_consume";

export type CatalogStockMovementRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  item_kind: CatalogStockItemKind;
  product_id: string | null;
  variant_id: string | null;
  ingredient_id: string | null;
  movement_type: CatalogStockMovementType;
  qty_delta: number;
  qty_after: number;
  occurred_at: string;
};

export type InventorySummaryKindFilter = "item_library" | "ingredients";

export type InventorySummaryStockItem = {
  itemKind: CatalogStockItemKind;
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  name: string;
  variantName: string | null;
  categoryName: string;
  currentQty: number;
  isParent: boolean;
};

export type InventorySummaryLine = InventorySummaryStockItem & {
  beginning: number;
  purchaseOrder: number;
  sales: number;
  transfer: number;
  adjustment: number;
  ending: number;
};
