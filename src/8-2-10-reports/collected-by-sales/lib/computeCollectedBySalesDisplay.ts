import {
  EMPTY_COLLECTED_BY_SALES_DISPLAY,
  type CollectedByPaymentKind,
  type CollectedByPaymentRow,
  type CollectedBySalesDisplay,
  type CollectedBySalesSortDir,
  type CollectedBySalesSortKey,
  type CollectedByStaffBlock,
} from "./collectedBySalesTypes";
import { parsePaymentKind } from "./paymentKindLabels";

const EPSILON = 0.01;
const PAYMENT_KIND_ORDER: CollectedByPaymentKind[] = ["cash", "non_cash"];

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function collectorKey(userId: string | null): string {
  return userId ?? "__unknown__";
}

function emptyPaymentRow(kind: CollectedByPaymentKind): CollectedByPaymentRow {
  return { paymentKind: kind, transactionCount: 0, totalCollected: 0 };
}

function buildPaymentRows(
  paymentRows: Array<Partial<Record<string, unknown>>>,
  collectorUserId: string | null,
): CollectedByPaymentRow[] {
  const key = collectorKey(collectorUserId);
  const byKind = new Map<CollectedByPaymentKind, CollectedByPaymentRow>();

  for (const row of paymentRows) {
    const rowUserId =
      row.collector_user_id != null ? String(row.collector_user_id) : null;
    if (collectorKey(rowUserId) !== key) continue;
    const kind = parsePaymentKind(row.payment_kind);
    byKind.set(kind, {
      paymentKind: kind,
      transactionCount: Math.max(0, Math.round(num(row, "transaction_count"))),
      totalCollected: num(row, "total_collected"),
    });
  }

  return PAYMENT_KIND_ORDER.map((kind) => byKind.get(kind) ?? emptyPaymentRow(kind));
}

export function buildCollectedBySalesDisplay(args: {
  staffRowsRaw: Array<Partial<Record<string, unknown>>>;
  paymentRowsRaw: Array<Partial<Record<string, unknown>>>;
  unknownStaffLabel: string;
}): CollectedBySalesDisplay {
  if (!args.staffRowsRaw?.length) {
    return EMPTY_COLLECTED_BY_SALES_DISPLAY;
  }

  const first = args.staffRowsRaw[0];
  const summaryTotalCollected = num(first, "summary_total_collected");
  const summaryTransactionCount = Math.max(
    0,
    Math.round(num(first, "summary_transaction_count")),
  );

  const staff: CollectedByStaffBlock[] = args.staffRowsRaw.map((row) => {
    const collectorUserId =
      row.collector_user_id != null ? String(row.collector_user_id) : null;
    const rawName = String(row.collector_name ?? "").trim();
    return {
      collectorUserId,
      collectorName: rawName || args.unknownStaffLabel,
      employeeId: row.employee_id != null ? String(row.employee_id) : null,
      transactionCount: Math.max(0, Math.round(num(row, "transaction_count"))),
      totalCollected: num(row, "total_collected"),
      payments: buildPaymentRows(args.paymentRowsRaw ?? [], collectorUserId),
    };
  });

  const grandTotal = staff.reduce(
    (acc, block) => ({
      transactionCount: acc.transactionCount + block.transactionCount,
      totalCollected: acc.totalCollected + block.totalCollected,
    }),
    { transactionCount: 0, totalCollected: 0 },
  );

  const matchesSummary =
    Math.abs(grandTotal.totalCollected - summaryTotalCollected) <= EPSILON &&
    grandTotal.transactionCount === summaryTransactionCount;

  return {
    staff,
    grandTotal,
    summaryTotalCollected,
    summaryTransactionCount,
    matchesSummary,
  };
}

export function sortCollectedByStaff(
  staff: CollectedByStaffBlock[],
  sortKey: CollectedBySalesSortKey,
  sortDir: CollectedBySalesSortDir,
): CollectedByStaffBlock[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...staff].sort((a, b) => {
    if (sortKey === "collectorName") {
      return a.collectorName.localeCompare(b.collectorName) * dir;
    }
    if (sortKey === "transactionCount") {
      return (a.transactionCount - b.transactionCount) * dir;
    }
    return (a.totalCollected - b.totalCollected) * dir;
  });
}

export function defaultExpandedStaffKey(display: CollectedBySalesDisplay): string | null {
  const withData = display.staff.find(
    (row) => row.transactionCount > 0 || row.totalCollected > 0.01,
  );
  return withData ? collectorKey(withData.collectorUserId) : null;
}

export function flattenCollectedByForExport(
  display: CollectedBySalesDisplay,
): Array<{
  collectorName: string;
  paymentLabel: string;
  transactionCount: number;
  totalCollected: number;
}> {
  const rows: Array<{
    collectorName: string;
    paymentLabel: string;
    transactionCount: number;
    totalCollected: number;
  }> = [];

  for (const block of display.staff) {
    rows.push({
      collectorName: block.collectorName,
      paymentLabel: "",
      transactionCount: block.transactionCount,
      totalCollected: block.totalCollected,
    });
    for (const payment of block.payments) {
      if (payment.transactionCount === 0 && payment.totalCollected <= EPSILON) continue;
      rows.push({
        collectorName: block.collectorName,
        paymentLabel: payment.paymentKind === "cash" ? "Cash" : "Non-Cash",
        transactionCount: payment.transactionCount,
        totalCollected: payment.totalCollected,
      });
    }
  }

  return rows;
}
