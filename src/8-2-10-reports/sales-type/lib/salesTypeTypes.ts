export type SalesTypeConfig = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  outletIds: string[];
};

export type SalesTypeRow = {
  salesTypeId: string | null;
  salesTypeName: string;
  sortOrder: number;
  transactionCount: number;
  grossSales: number;
  netSales: number;
  totalCollected: number;
  isUnassigned: boolean;
};

export type SalesTypeSummary = {
  transactionCount: number;
  grossSales: number;
  netSales: number;
  totalCollected: number;
};

export type SalesTypeDisplay = {
  rows: SalesTypeRow[];
  grandTotal: SalesTypeSummary;
  summaryGrossSales: number;
  summaryNetSales: number;
  summaryTransactionCount: number;
  summaryTotalCollected: number;
  matchesSummary: boolean;
};

export const UNASSIGNED_SALES_TYPE_KEY = "__unassigned__";

export const EMPTY_SALES_TYPE_DISPLAY: SalesTypeDisplay = {
  rows: [],
  grandTotal: {
    transactionCount: 0,
    grossSales: 0,
    netSales: 0,
    totalCollected: 0,
  },
  summaryGrossSales: 0,
  summaryNetSales: 0,
  summaryTransactionCount: 0,
  summaryTotalCollected: 0,
  matchesSummary: true,
};

export type SalesTypeSortKey = "name" | "transactionCount" | "grossSales" | "netSales";
export type SalesTypeSortDir = "asc" | "desc";
