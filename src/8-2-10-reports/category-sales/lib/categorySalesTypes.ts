export type CategorySalesRow = {
  categoryId: string | null;
  categoryName: string;
  sortOrder: number;
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

export type CategorySalesTotals = {
  qtySold: number;
  qtyRefunded: number;
  grossSales: number;
  netSales: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
};

export type CategorySalesDisplay = {
  rows: CategorySalesRow[];
  grandTotal: CategorySalesTotals;
  summaryProductNetSales: number;
  reconciliationOk: boolean;
  hasCogsIncomplete: boolean;
};

export const CATEGORY_SALES_RECONCILIATION_EPSILON = 0.01;

export const EMPTY_CATEGORY_SALES_DISPLAY: CategorySalesDisplay = {
  rows: [],
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

export type CategorySalesSortKey =
  | "categoryName"
  | "qtySold"
  | "qtyRefunded"
  | "grossSales"
  | "discountAmount"
  | "refundAmount"
  | "netSales"
  | "grossProfit";

export type CategorySalesSortDir = "asc" | "desc";

export const CATEGORY_SALES_COGS_DISMISS_STORAGE_PREFIX =
  "synckerja:reports:category-sales:cogs-dismissed:";
