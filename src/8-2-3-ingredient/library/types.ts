export type CatalogIngredientKind = "raw" | "semi_finished";

export type CatalogIngredientOutletStock = {
  outlet_id: string;
  in_stock: number;
  alert_enabled: boolean;
  alert_at: number | null;
  track_cogs: boolean;
  avg_cost: number;
};

export type CatalogIngredient = {
  id: string;
  organization_id: string;
  name: string;
  kind: CatalogIngredientKind;
  category_id: string | null;
  unit_code: string;
  track_inventory: boolean;
  sort_order: number;
  photo_path: string | null;
  photo_url: string | null;
  outlet_ids: string[];
  outlet_stocks: CatalogIngredientOutletStock[];
};

export type CatalogIngredientSave = {
  id?: string;
  name: string;
  kind: CatalogIngredientKind;
  category_id: string | null;
  unit_code: string;
  track_inventory: boolean;
  outlet_id: string;
  in_stock: number;
  alert_enabled: boolean;
  alert_at: number | null;
  track_cogs: boolean;
  avg_cost: number;
  photo_path?: string | null;
};

export type CatalogIngredientCategoryAssignment = {
  id: string;
  category_id: string | null;
};

export function emptyOutletStock(outletId: string): CatalogIngredientOutletStock {
  return {
    outlet_id: outletId,
    in_stock: 0,
    alert_enabled: false,
    alert_at: null,
    track_cogs: false,
    avg_cost: 0,
  };
}

export function stockForOutlet(
  ingredient: CatalogIngredient | null | undefined,
  outletId: string,
): CatalogIngredientOutletStock {
  const found = ingredient?.outlet_stocks.find((row) => row.outlet_id === outletId);
  return found ?? emptyOutletStock(outletId);
}
