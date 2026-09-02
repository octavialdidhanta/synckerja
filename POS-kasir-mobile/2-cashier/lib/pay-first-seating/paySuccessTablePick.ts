import { isDineInSalesType } from "./isDineInSalesType";

export type PaySuccessTablePickState = {
  needsTablePick: boolean;
  tableLabel: string | null;
};

/**
 * Success-screen seating: dine-in pay-first without a table must pick one
 * before Transaksi Baru. Print / email / SMS stay available.
 */
export function paySuccessTablePickState(args: {
  salesTypeLabel: string | null | undefined;
  hadOpenSessionBeforePay: boolean;
  posTableId?: string | null;
  sessionId?: string | null;
  tableName?: string | null;
}): PaySuccessTablePickState {
  const sessionId = args.sessionId ?? null;
  const posTableId = args.posTableId ?? null;
  const tableLabel = posTableId ? args.tableName?.trim() || null : null;
  const needsTablePick =
    isDineInSalesType(args.salesTypeLabel) &&
    !args.hadOpenSessionBeforePay &&
    !posTableId &&
    Boolean(sessionId);
  return { needsTablePick, tableLabel };
}

export function isPaySuccessNewTransactionBlocked(args: {
  needsTablePick?: boolean;
  tableLabel?: string | null;
}): boolean {
  return Boolean(args.needsTablePick) && !args.tableLabel;
}
