export type CatalogSalesType = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
  gratuity_ids: string[];
};

export type CatalogSalesTypeSave = {
  id?: string;
  name: string;
  is_active: boolean;
  outlet_ids: string[];
  gratuity_ids: string[];
};
