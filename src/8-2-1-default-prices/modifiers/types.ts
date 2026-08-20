export type CatalogModifierOption = {
  id: string;
  group_id: string;
  organization_id: string;
  name: string;
  extra_price: number;
  sort_order: number;
  is_active: boolean;
  inventory_sku_id: string | null;
};

export type CatalogModifierGroup = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  limit_enabled: boolean;
  is_required: boolean;
  max_selected: number;
  stock_enabled: boolean;
  options: CatalogModifierOption[];
  product_ids: string[];
  outlet_ids: string[];
};

export type CatalogModifierOptionInput = {
  id?: string;
  name: string;
  extra_price: number;
  inventory_sku_id?: string | null;
};

export type CatalogModifierGroupSave = {
  id?: string;
  name: string;
  limit_enabled: boolean;
  is_required: boolean;
  max_selected: number;
  stock_enabled: boolean;
  options: CatalogModifierOptionInput[];
  outlet_ids: string[];
};
