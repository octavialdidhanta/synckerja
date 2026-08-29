import * as XLSX from "xlsx";
import type { StockTransferListRow } from "../types";

export function exportTransfersXlsx(args: {
  rows: StockTransferListRow[];
  filename: string;
}): void {
  const header = ["Date", "From", "To", "Order Number", "Lines", "Total Qty", "Status"];
  const body = args.rows.map((row) => [
    row.occurredAt,
    row.fromOutletName,
    row.toOutletName,
    row.orderNumber,
    row.lineCount,
    row.totalQty,
    row.status,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, ws, "Transfers");
  XLSX.writeFile(wb, args.filename);
}
