import type { CatalogPosStatus } from '../lib/catalogKind';

export type CatalogKind = 'service' | 'product';

export interface DefaultPriceRow {
  id: string;
  organization_id: string;
  kind: CatalogKind;
  service_id: string | null;
  sub_service_id: string | null;
  unit_price: number;
  description?: string | null;
  name?: string | null;
  photo_path?: string | null;
  photo_url?: string | null;
  unit?: string | null;
  track_stock?: boolean;
  inventory_sku_id?: string | null;
  sku_code?: string | null;
  available_qty?: number | null;
  product_category_id?: string | null;
  product_category_name?: string | null;
  pos_status?: CatalogPosStatus;
  created_at?: string;
  updated_at?: string;
  service_name?: string;
  sub_service_name?: string;
}

export interface DefaultPriceCreate {
  id?: string;
  organization_id: string;
  kind?: CatalogKind;
  service_id: string | null;
  sub_service_id: string | null;
  unit_price: number;
  description?: string | null;
  name?: string | null;
  photo_path?: string | null;
  unit?: string | null;
  track_stock?: boolean;
  inventory_sku_id?: string | null;
  product_category_id?: string | null;
  pos_status?: CatalogPosStatus;
}

export interface DefaultPriceUpdate {
  unit_price?: number;
  description?: string | null;
  name?: string | null;
  photo_path?: string | null;
  unit?: string | null;
  track_stock?: boolean;
  inventory_sku_id?: string | null;
  product_category_id?: string | null;
  pos_status?: CatalogPosStatus;
}
