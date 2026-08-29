import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { formatItemDisplayName, resolveQtyAlaCarte, resolveQtyBundle } from "./computeItemSalesDisplay";
import type { ItemSalesDisplay, ItemSalesTab } from "./itemSalesTypes";

function dash(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

export function exportItemSalesSummaryXlsx(args: {
  display: ItemSalesDisplay;
  tab: ItemSalesTab;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const isIncome = args.tab === "income";

  const header = isIncome
    ? [
        "Name",
        "SKU",
        "Category",
        "Gross Sales",
        "Net Sales",
        "COGS",
        "Gross Profit",
        "Margin %",
      ]
    : ["Name", "SKU", "Category", "A la Carte", "Bundle", "Item Refunded"];

  const dataRows = args.display.rows.map((row) => {
    const name = formatItemDisplayName(row);
    if (isIncome) {
      return [
        name,
        dash(row.sku),
        dash(row.categoryName),
        formatReportsMoney(row.grossSales),
        formatReportsMoney(row.netSales),
        formatReportsMoney(row.cogs),
        formatReportsMoney(row.grossProfit),
        `${row.marginPct}%`,
      ];
    }
    return [
      name,
      dash(row.sku),
      dash(row.categoryName),
      resolveQtyAlaCarte(row),
      resolveQtyBundle(row),
      row.qtyRefunded,
    ];
  });

  const totalsRow = isIncome
    ? [
        "Grand Total",
        "",
        "",
        formatReportsMoney(args.display.totals.grossSales),
        formatReportsMoney(args.display.totals.netSales),
        formatReportsMoney(args.display.totals.cogs),
        formatReportsMoney(args.display.totals.grossProfit),
        "",
      ]
    : [
        "Grand Total",
        "",
        "",
        args.display.totals.qtyAlaCarte,
        args.display.totals.qtyBundle,
        args.display.totals.qtyRefunded,
      ];

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Tab", isIncome ? "Income" : "Quantity"],
    [],
    header,
    ...dataRows,
    [],
    totalsRow,
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Item Sales");
  XLSX.writeFile(wb, `item-sales-summary-${args.fromYmd}_${args.toYmd}.xlsx`);
}
