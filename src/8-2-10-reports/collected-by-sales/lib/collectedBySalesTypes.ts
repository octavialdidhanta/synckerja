export type CollectedByPaymentKind = "cash" | "non_cash";

export type CollectedByPaymentRow = {
  paymentKind: CollectedByPaymentKind;
  transactionCount: number;
  totalCollected: number;
};

export type CollectedByStaffBlock = {
  collectorUserId: string | null;
  collectorName: string;
  employeeId: string | null;
  transactionCount: number;
  totalCollected: number;
  payments: CollectedByPaymentRow[];
};

export type CollectedBySalesGrandTotal = {
  transactionCount: number;
  totalCollected: number;
};

export type CollectedBySalesDisplay = {
  staff: CollectedByStaffBlock[];
  grandTotal: CollectedBySalesGrandTotal;
  summaryTotalCollected: number;
  summaryTransactionCount: number;
  matchesSummary: boolean;
};

export const EMPTY_COLLECTED_BY_SALES_DISPLAY: CollectedBySalesDisplay = {
  staff: [],
  grandTotal: { transactionCount: 0, totalCollected: 0 },
  summaryTotalCollected: 0,
  summaryTransactionCount: 0,
  matchesSummary: true,
};

export type CollectedBySalesSortKey = "collectorName" | "transactionCount" | "totalCollected";
export type CollectedBySalesSortDir = "asc" | "desc";
