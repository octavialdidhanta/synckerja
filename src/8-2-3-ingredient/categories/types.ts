export type CatalogIngredientCategory = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  outlet_ids: string[];
};

export type CatalogIngredientCategorySave = {
  id?: string;
  name: string;
  outlet_id?: string;
};
