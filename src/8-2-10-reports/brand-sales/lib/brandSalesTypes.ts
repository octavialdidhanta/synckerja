export type BrandSalesMetrics = {
  qtySold: number;
  qtyRefunded: number;
  grossSales: number;
  netSales: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  cogsIncomplete: boolean;
  cogsEstimated: boolean;
};

export type BrandSalesBrandRow = BrandSalesMetrics & {
  brandId: string | null;
  brandName: string;
  sortOrder: number;
};

export type BrandSalesItemRow = BrandSalesMetrics & {
  brandId: string | null;
  brandName: string;
  brandSortOrder: number;
  catalogProductId: string | null;
  catalogVariantId: string | null;
  catalogBundleId: string | null;
  itemName: string;
  variantName: string | null;
  sku: string | null;
};

export type BrandSalesOutletRow = BrandSalesMetrics & {
  brandId: string | null;
  brandName: string;
  outletId: string;
  outletName: string;
};

export type BrandSalesDisplayRow =
  | ({ rowKind: "brand" } & BrandSalesBrandRow)
  | ({ rowKind: "item" } & BrandSalesItemRow);

export type BrandSalesTotals = {
  qtySold: number;
  qtyRefunded: number;
  grossSales: number;
  netSales: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
};

export type BrandSalesDisplay = {
  brands: BrandSalesBrandRow[];
  items: BrandSalesItemRow[];
  displayRows: BrandSalesDisplayRow[];
  grandTotal: BrandSalesTotals;
  summaryProductNetSales: number;
  reconciliationOk: boolean;
  hasCogsIncomplete: boolean;
};

export const BRAND_SALES_RECONCILIATION_EPSILON = 0.01;

export const EMPTY_BRAND_SALES_DISPLAY: BrandSalesDisplay = {
  brands: [],
  items: [],
  displayRows: [],
  grandTotal: {
    qtySold: 0,
    qtyRefunded: 0,
    grossSales: 0,
    netSales: 0,
    discountAmount: 0,
    refundAmount: 0,
    cogs: 0,
    grossProfit: 0,
  },
  summaryProductNetSales: 0,
  reconciliationOk: true,
  hasCogsIncomplete: false,
};

export type BrandSalesSortKey =
  | "brandName"
  | "qtySold"
  | "qtyRefunded"
  | "grossSales"
  | "discountAmount"
  | "refundAmount"
  | "netSales"
  | "grossProfit";

export type BrandSalesSortDir = "asc" | "desc";

export const BRAND_SALES_COGS_DISMISS_STORAGE_PREFIX =
  "synckerja:reports:brand-sales:cogs-dismissed:";

export type BrandSalesExportKind = "byOutlet" | "byItem";
