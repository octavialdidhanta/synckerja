export const POS_FAVORITES_MAX = 100;

export type PosOutletFavorite = {
  id: string;
  organization_id: string;
  outlet_id: string;
  catalog_item_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
