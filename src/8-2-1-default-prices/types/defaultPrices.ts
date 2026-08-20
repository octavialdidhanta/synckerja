import type { CatalogPosStatus } from '../lib/catalogKind';
import type { ProductOutletOverride } from '../product-outlets/types';
import type {
  CatalogProductSalesTypePrice,
  CatalogProductVariant,
  CatalogProductVariantOutletStock,
  ProductOutletStock,
} from '../product-variants/types';

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
  catalog_sku?: string | null;
  use_sales_type_prices?: boolean;
  variants?: CatalogProductVariant[];
  sales_type_prices?: CatalogProductSalesTypePrice[];
  outlet_stocks?: Record<string, ProductOutletStock>;
  variant_outlet_stocks?: CatalogProductVariantOutletStock[];
  available_qty?: number | null;
  product_category_id?: string | null;
  product_category_name?: string | null;
  product_brand_id?: string | null;
  product_brand_name?: string | null;
  pos_status?: CatalogPosStatus;
  outlet_ids?: string[];
  outlet_overrides?: Record<string, ProductOutletOverride>;
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
  catalog_sku?: string | null;
  use_sales_type_prices?: boolean;
  variants?: CatalogProductVariant[];
  sales_type_prices?: CatalogProductSalesTypePrice[];
  selected_outlet_stock?: ProductOutletStock | null;
  variant_outlet_stocks?: CatalogProductVariantOutletStock[];
  product_category_id?: string | null;
  product_brand_id?: string | null;
  pos_status?: CatalogPosStatus;
  outlet_ids?: string[];
  selected_outlet_id?: string | null;
  use_default_price?: boolean;
  use_default_status?: boolean;
  outlet_overrides?: Record<string, ProductOutletOverride>;
}

export interface DefaultPriceUpdate {
  unit_price?: number;
  description?: string | null;
  name?: string | null;
  photo_path?: string | null;
  unit?: string | null;
  track_stock?: boolean;
  inventory_sku_id?: string | null;
  catalog_sku?: string | null;
  use_sales_type_prices?: boolean;
  variants?: CatalogProductVariant[];
  sales_type_prices?: CatalogProductSalesTypePrice[];
  selected_outlet_stock?: ProductOutletStock | null;
  variant_outlet_stocks?: CatalogProductVariantOutletStock[];
  product_category_id?: string | null;
  product_brand_id?: string | null;
  pos_status?: CatalogPosStatus;
  outlet_ids?: string[];
  selected_outlet_id?: string | null;
  use_default_price?: boolean;
  use_default_status?: boolean;
  outlet_overrides?: Record<string, ProductOutletOverride>;
}
