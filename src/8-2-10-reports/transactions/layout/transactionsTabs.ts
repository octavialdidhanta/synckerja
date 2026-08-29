export type TransactionsTabId = "success" | "cancelled" | "void";

export const TRANSACTIONS_TAB_IDS: TransactionsTabId[] = ["success", "cancelled", "void"];

export function parseTransactionsTab(raw: string | null): TransactionsTabId {
  if (raw === "cancelled" || raw === "void") return raw;
  return "success";
}

export function transactionsTabLabelKey(tab: TransactionsTabId): string {
  switch (tab) {
    case "cancelled":
      return "reports.transactions.tabs.cancelled";
    case "void":
      return "reports.transactions.tabs.void";
    default:
      return "reports.transactions.tabs.success";
  }
}
