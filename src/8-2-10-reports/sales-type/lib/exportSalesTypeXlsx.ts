import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { SalesTypeDisplay } from "./salesTypeTypes";

export function exportSalesTypeXlsx(args: {
  display: SalesTypeDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Sales Type", "Count", "Gross Sales", "Net Sales", "Total Collected"],
    ...args.display.rows.map((row) => [
      row.salesTypeName,
      row.transactionCount,
      formatReportsMoney(row.grossSales),
      formatReportsMoney(row.netSales),
      formatReportsMoney(row.totalCollected),
    ]),
    [],
    [
      "Grand Total",
      args.display.grandTotal.transactionCount,
      formatReportsMoney(args.display.grandTotal.grossSales),
      formatReportsMoney(args.display.grandTotal.netSales),
      formatReportsMoney(args.display.grandTotal.totalCollected),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sales Type");
  XLSX.writeFile(wb, `sales-type-${args.fromYmd}_${args.toYmd}.xlsx`);
}
