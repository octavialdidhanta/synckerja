import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import type { TransactionsTabId } from "../../layout/transactionsTabs";
import type {
  CancelledOrderRow,
  SuccessOrderRow,
  VoidItemRow,
} from "./transactionsTypes";
import { computeCartSnapshotTotal } from "./computeCartSnapshotTotal";
import { format, parseISO } from "date-fns";

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return "";
  }
}

export function exportTransactionsXlsx(args: {
  tab: TransactionsTabId;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
  successRows?: SuccessOrderRow[];
  cancelledRows?: CancelledOrderRow[];
  voidRows?: VoidItemRow[];
}): void {
  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Tab", args.tab],
    [],
  ];

  if (args.tab === "success" && args.successRows) {
    rows.push(
      ["Outlet", "Date", "Time", "Receipt", "Collected By", "Items", "Total Collected", "Net Sales"],
      ...args.successRows.map((row) => [
        row.outletName,
        row.createdAt.slice(0, 10),
        formatTime(row.createdAt),
        row.receiptCode,
        row.collectedByName,
        row.itemSummary,
        formatReportsMoney(row.totalCollected),
        formatReportsMoney(row.netSales),
      ]),
    );
  } else if (args.tab === "cancelled" && args.cancelledRows) {
    rows.push(
      ["Outlet", "Date", "Time", "Table", "Staff", "Items", "Reason", "Est. Total"],
      ...args.cancelledRows.map((row) => [
        row.outletName,
        row.closedAt.slice(0, 10),
        formatTime(row.closedAt),
        row.tableName,
        row.staffName,
        row.itemSummary,
        row.cancelReason,
        formatReportsMoney(computeCartSnapshotTotal(row.cartSnapshot)),
      ]),
    );
  } else if (args.tab === "void" && args.voidRows) {
    rows.push(
      ["Outlet", "Date", "Time", "Table", "Product", "Qty", "Unit Price", "Line Total", "Staff", "Reason"],
      ...args.voidRows.map((row) => [
        row.outletName,
        row.createdAt.slice(0, 10),
        formatTime(row.createdAt),
        row.tableName,
        row.productName,
        row.quantity,
        formatReportsMoney(row.unitPrice),
        formatReportsMoney(row.lineTotal),
        row.voidedByName,
        row.reason,
      ]),
    );
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Transactions");
  XLSX.writeFile(wb, `transactions-${args.tab}-${args.fromYmd}_${args.toYmd}.xlsx`);
}
