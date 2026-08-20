export type CatalogProductCategory = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
};

export type CatalogProductCategorySave = {
  id?: string;
  name: string;
  outlet_ids: string[];
};
