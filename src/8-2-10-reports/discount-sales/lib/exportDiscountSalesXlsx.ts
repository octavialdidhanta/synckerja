import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { sortDiscountValuesForExport } from "./computeDiscountSalesDisplay";
import type { DiscountSalesDisplay } from "./discountSalesTypes";

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function exportDiscountSalesXlsx(args: {
  display: DiscountSalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const sortedValues = sortDiscountValuesForExport(args.display.values);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    [
      "Discount Name",
      "Discount Value",
      "Times Applied",
      "Gross Discount",
      "Refund",
      "Net Discount",
    ],
    ...sortedValues.map((row) => [
      row.discountName,
      row.valueLabel,
      formatCount(row.timesApplied),
      formatDeduction(row.grossDiscount),
      formatDeduction(row.refundAmount),
      formatDeduction(row.netDiscount),
    ]),
    [],
    [
      "Grand Total",
      "",
      formatCount(args.display.grandTotal.timesApplied),
      formatDeduction(args.display.grandTotal.grossDiscount),
      formatDeduction(args.display.grandTotal.refundAmount),
      formatDeduction(args.display.grandTotal.netDiscount),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Discount Sales");
  XLSX.writeFile(wb, `discount-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
