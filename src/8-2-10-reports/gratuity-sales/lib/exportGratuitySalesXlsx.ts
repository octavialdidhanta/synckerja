import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { sortGratuityRatesForExport } from "./computeGratuitySalesDisplay";
import type { GratuitySalesDisplay } from "./gratuitySalesTypes";

export function exportGratuitySalesXlsx(args: {
  display: GratuitySalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const sortedRates = sortGratuityRatesForExport(args.display.rates);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Gratuity Name", "Rate", "Gratuity Collected"],
    ...sortedRates.map((row) => [
      row.gratuityName,
      row.rateLabel,
      formatReportsMoney(row.gratuityCollected),
    ]),
    [],
    [
      "Total Gratuity Collected",
      "",
      formatReportsMoney(args.display.grandTotal.gratuityCollected),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Gratuity Sales");
  XLSX.writeFile(wb, `gratuity-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
