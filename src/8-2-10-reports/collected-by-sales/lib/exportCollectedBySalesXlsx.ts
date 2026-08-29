import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { flattenCollectedByForExport } from "./computeCollectedBySalesDisplay";
import type { CollectedBySalesDisplay } from "./collectedBySalesTypes";

export function exportCollectedBySalesXlsx(args: {
  display: CollectedBySalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const flat = flattenCollectedByForExport(args.display);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Collected By", "Payment Type", "Number of Transactions", "Total Collected"],
    ...flat.map((row) => [
      row.collectorName,
      row.paymentLabel,
      row.transactionCount,
      formatReportsMoney(row.totalCollected),
    ]),
    [],
    [
      "Grand Total",
      "",
      args.display.grandTotal.transactionCount,
      formatReportsMoney(args.display.grandTotal.totalCollected),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Collected By");
  XLSX.writeFile(wb, `collected-by-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
