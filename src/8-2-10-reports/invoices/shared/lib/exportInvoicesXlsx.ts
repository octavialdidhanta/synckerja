import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import type { InvoiceRow } from "./invoicesTypes";

export type InvoiceExportMode = "transactions" | "itemDetails";

export type InvoiceItemExportRow = {
  invoiceNumber: string;
  clientName: string;
  outletName: string;
  serviceName: string;
  subServiceName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  displayStatus: string;
};

export function exportInvoicesXlsx(args: {
  mode: InvoiceExportMode;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
  rows: InvoiceRow[];
  itemRows?: InvoiceItemExportRow[];
}): void {
  const meta: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Export", args.mode],
    [],
  ];

  let sheetRows: Array<Array<string | number>>;

  if (args.mode === "itemDetails" && args.itemRows) {
    sheetRows = [
      ...meta,
      [
        "Invoice #",
        "Customer",
        "Outlet",
        "Item",
        "Sub-item",
        "Qty",
        "Unit Price",
        "Line Total",
        "Status",
      ],
      ...args.itemRows.map((row) => [
        row.invoiceNumber,
        row.clientName,
        row.outletName,
        row.serviceName,
        row.subServiceName ?? "",
        row.quantity,
        formatReportsMoney(row.unitPrice),
        formatReportsMoney(row.totalPrice),
        row.displayStatus,
      ]),
    ];
  } else {
    sheetRows = [
      ...meta,
      [
        "Date",
        "Invoice #",
        "Outlet",
        "Customer",
        "Status",
        "Total",
        "Paid",
        "Due",
        "Items",
      ],
      ...args.rows.map((row) => [
        row.createdAt.slice(0, 10),
        row.invoiceNumber,
        row.outletName,
        row.clientName,
        row.displayStatus,
        formatReportsMoney(row.totalAmount),
        formatReportsMoney(row.totalPaidAmount),
        formatReportsMoney(row.amountDue),
        row.itemSummary,
      ]),
    ];
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    args.mode === "itemDetails" ? "Item Details" : "Transactions",
  );
  XLSX.writeFile(wb, `invoices-${args.mode}-${args.fromYmd}-${args.toYmd}.xlsx`);
}
