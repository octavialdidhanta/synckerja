export type CatalogProductVariant = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  sort_order: number;
};

export type CatalogProductSalesTypePrice = {
  variant_id: string | null;
  sales_type_id: string;
  price: number;
};

export type ProductOutletStock = {
  in_stock: number;
  alert_enabled: boolean;
  alert_at: number | null;
  track_cogs: boolean;
  avg_cost: number;
};

export type CatalogProductVariantOutletStock = ProductOutletStock & {
  variant_id: string;
  outlet_id: string;
};

export type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  priceDisplay: string;
};

export type InventoryRowDraft = {
  variantId: string | null;
  trackStock: boolean;
  inStock: string;
  alertEnabled: boolean;
  alertAt: string;
};

export type CogsRowDraft = {
  variantId: string | null;
  trackCogs: boolean;
  avgCost: string;
};

export function emptyOutletStock(): ProductOutletStock {
  return {
    in_stock: 0,
    alert_enabled: false,
    alert_at: null,
    track_cogs: false,
    avg_cost: 0,
  };
}

export function newVariantDraft(): VariantDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    sku: "",
    priceDisplay: "",
  };
}
