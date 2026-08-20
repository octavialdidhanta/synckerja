import * as XLSX from "xlsx";
import type { InventorySummaryLine } from "../types";

export function exportInventorySummaryXlsx(args: {
  lines: InventorySummaryLine[];
  filename: string;
}): void {
  const header = [
    "Name",
    "Variant",
    "Category",
    "Beginning",
    "Purchase Order",
    "Sales",
    "Transfer",
    "Adjustment",
    "Ending",
  ];
  const body = args.lines.map((row) => [
    row.name,
    row.variantName ?? "",
    row.categoryName,
    row.isParent ? "" : row.beginning,
    row.isParent ? "" : row.purchaseOrder,
    row.isParent ? "" : row.sales,
    row.isParent ? "" : row.transfer,
    row.isParent ? "" : row.adjustment,
    row.isParent ? "" : row.ending,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  XLSX.writeFile(wb, args.filename);
}
