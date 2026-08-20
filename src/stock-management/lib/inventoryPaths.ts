/** Canonical UI URL (Shared Inventory). */
export const STOCK_MANAGEMENT_BASE_PATH = "/operations/inventory";
export const STOCK_MANAGEMENT_DASHBOARD_PATH = STOCK_MANAGEMENT_BASE_PATH;
export const STOCK_MANAGEMENT_MAPPING_PATH = `${STOCK_MANAGEMENT_BASE_PATH}/mapping`;
export const STOCK_MANAGEMENT_ADJUSTMENT_PATH = `${STOCK_MANAGEMENT_BASE_PATH}/adjustment`;
export const STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH = `${STOCK_MANAGEMENT_BASE_PATH}/purchase-orders`;
export const STOCK_MANAGEMENT_SUPPLIERS_PATH = `${STOCK_MANAGEMENT_BASE_PATH}/suppliers`;
export const STOCK_MANAGEMENT_SYNC_LOGS_PATH = `${STOCK_MANAGEMENT_BASE_PATH}/sync-logs`;

/** Permission catalog key — keep in sync with existing org page_path rows. */
export const STOCK_MANAGEMENT_PAGE_ACCESS_PATH = "/operations/sales/stock-management";
export const STOCK_MANAGEMENT_PAGE_PATH = STOCK_MANAGEMENT_PAGE_ACCESS_PATH;

/** Old bookmarks; App.tsx redirects these to STOCK_MANAGEMENT_* paths. */
export const STOCK_MANAGEMENT_LEGACY_BASE_PATH = "/operations/sales/stock-management";
export const STOCK_MANAGEMENT_LEGACY_MAPPING_PATH = `${STOCK_MANAGEMENT_LEGACY_BASE_PATH}/mapping`;
export const STOCK_MANAGEMENT_LEGACY_SYNC_LOGS_PATH = `${STOCK_MANAGEMENT_LEGACY_BASE_PATH}/sync-logs`;
