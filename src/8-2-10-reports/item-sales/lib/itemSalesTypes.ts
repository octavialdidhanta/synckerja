export type ItemSalesRow = {
  catalogProductId: string | null;
  catalogVariantId: string | null;
  catalogBundleId: string | null;
  itemName: string;
  variantName: string | null;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  qtySold: number;
  qtyRefunded: number;
  grossSales: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  cogsIncomplete: boolean;
  cogsEstimated: boolean;
};

export type ItemSalesHourlyRow = {
  productKey: string;
  itemName: string;
  variantName: string | null;
  sku: string | null;
  hour: number;
  qty: number;
  netSales: number;
};

export type ItemSalesTab = "income" | "quantity";

export type ItemSalesIncomeSortKey =
  | "name"
  | "sku"
  | "category"
  | "grossSales"
  | "netSales"
  | "cogs"
  | "grossProfit"
  | "marginPct";

export type ItemSalesQuantitySortKey =
  | "name"
  | "sku"
  | "category"
  | "qtyAlaCarte"
  | "qtyBundle"
  | "qtySold";

export type ItemSalesSortDir = "asc" | "desc";

export type ItemSalesDisplay = {
  rows: ItemSalesRow[];
  summaryProductNetSales: number;
  totals: {
    qtySold: number;
    qtyAlaCarte: number;
    qtyBundle: number;
    qtyRefunded: number;
    grossSales: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
  };
  reconciliationOk: boolean;
};

export type ItemSalesHourlyDisplay = {
  rows: ItemSalesHourlyRow[];
  itemKeys: string[];
  hours: number[];
};

export const ITEM_SALES_TOP_N = 50;

export const ITEM_SALES_RECONCILIATION_EPSILON = 0.01;

export const EMPTY_ITEM_SALES_DISPLAY: ItemSalesDisplay = {
  rows: [],
  summaryProductNetSales: 0,
  totals: {
    qtySold: 0,
    qtyAlaCarte: 0,
    qtyBundle: 0,
    qtyRefunded: 0,
    grossSales: 0,
    netSales: 0,
    cogs: 0,
    grossProfit: 0,
  },
  reconciliationOk: true,
};

export const EMPTY_ITEM_SALES_HOURLY_DISPLAY: ItemSalesHourlyDisplay = {
  rows: [],
  itemKeys: [],
  hours: Array.from({ length: 24 }, (_, i) => i),
};
