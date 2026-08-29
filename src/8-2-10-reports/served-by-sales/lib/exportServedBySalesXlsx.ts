import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { flattenServedByForExport } from "./computeServedBySalesDisplay";
import type { ServedBySalesDisplay } from "./servedBySalesTypes";

export function exportServedBySalesXlsx(args: {
  display: ServedBySalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const flat = flattenServedByForExport(args.display);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Served By", "Sales Type", "Number of Transactions", "Gross Sales", "Net Sales"],
    ...flat.map((row) => [
      row.serverName,
      row.salesTypeLabel,
      row.transactionCount,
      formatReportsMoney(row.grossSales),
      formatReportsMoney(row.netSales),
    ]),
    [],
    [
      "Grand Total",
      "",
      args.display.grandTotal.transactionCount,
      formatReportsMoney(args.display.grandTotal.grossSales),
      formatReportsMoney(args.display.grandTotal.netSales),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Served By");
  XLSX.writeFile(wb, `served-by-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
