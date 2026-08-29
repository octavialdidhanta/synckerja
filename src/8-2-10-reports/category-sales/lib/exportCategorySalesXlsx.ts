import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { CategorySalesDisplay } from "./categorySalesTypes";

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

export function exportCategorySalesXlsx(args: {
  display: CategorySalesDisplay;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    [
      "Category",
      "Items Sold",
      "Items Refunded",
      "Gross Sales",
      "Discount",
      "Refunds",
      "Net Sales",
      "Gross Profit",
    ],
    ...args.display.rows.map((row) => [
      row.categoryName,
      row.qtySold,
      row.qtyRefunded,
      formatReportsMoney(row.grossSales),
      formatDeduction(row.discountAmount),
      formatDeduction(row.refundAmount),
      formatReportsMoney(row.netSales),
      formatReportsMoney(row.grossProfit),
    ]),
    [],
    [
      "Grand Total",
      args.display.grandTotal.qtySold,
      args.display.grandTotal.qtyRefunded,
      formatReportsMoney(args.display.grandTotal.grossSales),
      formatDeduction(args.display.grandTotal.discountAmount),
      formatDeduction(args.display.grandTotal.refundAmount),
      formatReportsMoney(args.display.grandTotal.netSales),
      formatReportsMoney(args.display.grandTotal.grossProfit),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Category Sales");
  XLSX.writeFile(wb, `category-sales-${args.fromYmd}_${args.toYmd}.xlsx`);
}
