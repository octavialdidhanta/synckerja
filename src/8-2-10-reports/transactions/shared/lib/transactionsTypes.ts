export type TransactionsTabId = "success" | "cancelled" | "void";

export const TRANSACTIONS_TAB_IDS: TransactionsTabId[] = ["success", "cancelled", "void"];

export function parseTransactionsTab(raw: string | null): TransactionsTabId {
  if (raw === "cancelled" || raw === "void") return raw;
  return "success";
}

export type SuccessOrderRow = {
  activityId: string;
  createdAt: string;
  outletId: string | null;
  outletName: string;
  receiptCode: string;
  collectedByUserId: string | null;
  collectedByName: string;
  servedByUserId: string | null;
  servedByName: string | null;
  itemSummary: string;
  totalCollected: number;
  netSales: number;
  grossSales: number;
};

export type SuccessOrdersSummary = {
  transactionCount: number;
  totalCollected: number;
  netSales: number;
};

export type CancelledOrderRow = {
  sessionId: string;
  closedAt: string;
  outletId: string;
  outletName: string;
  tableName: string;
  staffUserId: string | null;
  staffName: string;
  cancelReason: string;
  itemSummary: string;
  cartSnapshot: unknown[];
};

export type VoidItemRow = {
  voidId: string;
  createdAt: string;
  outletId: string;
  outletName: string;
  sessionId: string | null;
  tableName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  reason: string;
  voidedByUserId: string | null;
  voidedByName: string;
};

export type DateGroupedRow<T> = {
  dateKey: string;
  dateLabel: string;
  dayTotal: number;
  rows: T[];
};
