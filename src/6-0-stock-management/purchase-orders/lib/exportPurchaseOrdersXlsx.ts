import * as XLSX from "xlsx";
import type { PurchaseOrderListRow } from "../types";

export function exportPurchaseOrdersXlsx(args: {
  rows: PurchaseOrderListRow[];
  filename: string;
}): void {
  const header = ["PO Date", "Outlet", "Supplier", "Order Number", "Total Value", "Status"];
  const body = args.rows.map((row) => [
    row.occurredAt,
    row.outletName,
    row.supplierName,
    row.orderNumber,
    row.totalValue,
    row.status,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Orders");
  XLSX.writeFile(wb, args.filename);
}
