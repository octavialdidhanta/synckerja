export type ServedBySalesTypeRow = {
  catalogSalesTypeId: string | null;
  salesTypeName: string;
  transactionCount: number;
  grossSales: number;
  netSales: number;
};

export type ServedByServerBlock = {
  serverUserId: string | null;
  serverName: string;
  employeeId: string | null;
  transactionCount: number;
  grossSales: number;
  netSales: number;
  salesTypes: ServedBySalesTypeRow[];
};

export type ServedBySalesGrandTotal = {
  transactionCount: number;
  grossSales: number;
  netSales: number;
};

export type ServedBySalesDisplay = {
  servers: ServedByServerBlock[];
  grandTotal: ServedBySalesGrandTotal;
  summaryGrossSales: number;
  summaryNetSales: number;
  summaryTransactionCount: number;
  matchesSummaryGross: boolean;
  matchesSummaryNet: boolean;
};

export const EMPTY_SERVED_BY_SALES_DISPLAY: ServedBySalesDisplay = {
  servers: [],
  grandTotal: { transactionCount: 0, grossSales: 0, netSales: 0 },
  summaryGrossSales: 0,
  summaryNetSales: 0,
  summaryTransactionCount: 0,
  matchesSummaryGross: true,
  matchesSummaryNet: true,
};

export type ServedBySalesSortKey =
  | "serverName"
  | "transactionCount"
  | "grossSales"
  | "netSales";
export type ServedBySalesSortDir = "asc" | "desc";
