export type CatalogGratuity = {
  id: string;
  organization_id: string;
  name: string;
  amount_percent: number;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
};

export type CatalogGratuitySave = {
  id?: string;
  name: string;
  amount_percent: number;
  outlet_ids: string[];
};
