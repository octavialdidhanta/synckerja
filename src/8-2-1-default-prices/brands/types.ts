export type CatalogBrand = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
};

export type CatalogBrandSave = {
  id?: string;
  name: string;
  outlet_ids: string[];
};
