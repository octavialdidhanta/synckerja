import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { sortTaxRatesForExport } from "./computeTaxSalesDisplay";
import type { TaxSalesDisplay } from "./taxSalesTypes";

export function exportTaxSalesXlsx(args: {
  display: TaxSalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const sortedRates = sortTaxRatesForExport(args.display.rates);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Tax Name", "Tax Rate", "Taxable Amount", "Tax Collected"],
    ...sortedRates.map((row) => [
      row.taxName,
      row.rateLabel,
      formatReportsMoney(row.taxableAmount),
      formatReportsMoney(row.taxCollected),
    ]),
    [],
    [
      "Total Tax Collected",
      "",
      formatReportsMoney(args.display.grandTotal.taxableAmount),
      formatReportsMoney(args.display.grandTotal.taxCollected),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Tax Sales");
  XLSX.writeFile(wb, `tax-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
