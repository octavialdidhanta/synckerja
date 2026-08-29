import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { sortModifierOptionsForExport } from "./computeModifierSalesDisplay";
import type { ModifierSalesDisplay } from "./modifierSalesTypes";

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

export function exportModifierSalesXlsx(args: {
  display: ModifierSalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const sortedOptions = sortModifierOptionsForExport(args.display.options);

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    [
      "Modifier Group",
      "Modifier Option",
      "Qty Sold",
      "Gross Sales",
      "Discount",
      "Refund",
      "Net Sales",
    ],
    ...sortedOptions.map((row) => [
      row.groupName,
      row.optionName,
      row.qtySold,
      formatReportsMoney(row.grossSales),
      formatDeduction(row.discountAmount),
      formatDeduction(row.refundAmount),
      formatReportsMoney(row.netSales),
    ]),
    [],
    [
      "Grand Total",
      "",
      args.display.grandTotal.qtySold,
      formatReportsMoney(args.display.grandTotal.grossSales),
      formatDeduction(args.display.grandTotal.discountAmount),
      formatDeduction(args.display.grandTotal.refundAmount),
      formatReportsMoney(args.display.grandTotal.netSales),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Modifier Sales");
  XLSX.writeFile(wb, `modifier-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
