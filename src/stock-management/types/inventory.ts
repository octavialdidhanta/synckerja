export type InventorySkuRow = {
  id: string;
  product_id: string;
  product_name: string;
  internal_sku: string;
  name: string;
  barcode: string | null;
  unit: string;
  variant_label: string | null;
  is_active: boolean;
  available_qty: number;
  reserved_qty: number;
};

export type InventoryMovementRow = {
  id: string;
  sku_id: string;
  movement_type: string;
  qty_delta: number;
  qty_after: number;
  platform: string | null;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
};

export type InventoryPlatformMappingRow = {
  id: string;
  sku_id: string;
  platform: string;
  platform_product_id: string;
  platform_sku_id: string;
  seller_sku: string;
  shop_account_id: string | null;
  warehouse_id: string | null;
  is_active: boolean;
  inventory_skus?: { internal_sku: string; name: string } | { internal_sku: string; name: string }[] | null;
};

export type InventorySyncLogRow = {
  id: string;
  sku_id: string;
  internal_sku: string | null;
  sku_name: string | null;
  product_name: string | null;
  platform: string;
  platform_product_id: string | null;
  platform_sku_id: string | null;
  seller_sku: string | null;
  target_qty: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
};

export type InventoryPlatform =
  | "tiktok_shop"
  | "shopee"
  | "tokopedia"
  | "blibli";

export const INVENTORY_PLATFORMS: { value: InventoryPlatform; labelKey: string; defaultLabel: string }[] = [
  { value: "tiktok_shop", labelKey: "operations.stockManagement.platform.tiktokShop", defaultLabel: "TikTok Shop" },
  { value: "shopee", labelKey: "operations.stockManagement.platform.shopee", defaultLabel: "Shopee" },
  { value: "tokopedia", labelKey: "operations.stockManagement.platform.tokopedia", defaultLabel: "Tokopedia" },
  { value: "blibli", labelKey: "operations.stockManagement.platform.blibli", defaultLabel: "BliBli" },
];
