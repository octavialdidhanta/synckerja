import * as XLSX from "xlsx";
import { formatGrossProfitMoney } from "./computeGrossProfitDisplay";
import { sumGrossProfitItemRows } from "./computeGrossProfitItemsTotals";
import { computeWaterfallPercent } from "./computeGrossProfitWaterfall";
import type { GrossProfitItemRow } from "./grossProfitItemTypes";
import type { GrossProfitMetrics } from "./grossProfitTypes";
import { sumNonProductBreakdownQty } from "./computeGrossProfitNonProductDisplay";
import type { GrossProfitNonProductRow } from "./grossProfitNonProductTypes";

export function exportGrossProfitXlsx(args: {
  metrics: GrossProfitMetrics;
  items: GrossProfitItemRow[];
  nonProductRows?: GrossProfitNonProductRow[];
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const { metrics } = args;
  const cogsPct = computeWaterfallPercent(metrics, "cogs").percent;
  const summaryRows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Metric", "Amount", "% of Net Sales"],
    ["Gross Sales", formatGrossProfitMoney(metrics.grossSales), ""],
    ["Discounts", formatGrossProfitMoney(metrics.discounts, { asDeduction: true }), ""],
    [
      "Refunds",
      formatGrossProfitMoney(metrics.refunds, { asDeduction: true }),
      "By refund date; excluded from Net/GP",
    ],
    ["Net Sales", formatGrossProfitMoney(metrics.netSales), "100%"],
  ];

  if (metrics.nonProductNet > 0.01) {
    summaryRows.push([
      "Non-product / custom revenue",
      formatGrossProfitMoney(metrics.nonProductNet),
      "",
    ]);
  }

  summaryRows.push(
    ["Product Net Sales", formatGrossProfitMoney(metrics.productNetSales), ""],
    ["COGS", formatGrossProfitMoney(metrics.cogs, { asDeduction: true }), cogsPct != null ? `${cogsPct}%` : ""],
  );

  if (Math.abs(metrics.cogsAdjustment) > 0.01) {
    const adjPct = computeWaterfallPercent(metrics, "cogsAdjustment").percent;
    summaryRows.push([
      "COGS Adjustment",
      formatGrossProfitMoney(metrics.cogsAdjustment, { asDeduction: metrics.cogsAdjustment > 0 }),
      adjPct != null ? `${adjPct}%` : "",
    ]);
  }

  if (Math.abs(metrics.cogsReversed) > 0.01) {
    const revPct = computeWaterfallPercent(metrics, "cogsReversed").percent;
    summaryRows.push([
      "COGS reversed on refund (informational)",
      formatGrossProfitMoney(metrics.cogsReversed),
      revPct != null ? `${revPct}%` : "Not deducted from GP",
    ]);
  }

  summaryRows.push(
    ["Gross Profit", formatGrossProfitMoney(metrics.grossProfit), `${metrics.grossProfitMargin}%`],
    ["Transactions", String(metrics.transactionCount), ""],
    ["COGS incomplete", metrics.cogsIncomplete ? "Yes" : "No", ""],
  );

  const itemTotals = sumGrossProfitItemRows(args.items);
  const itemRows: Array<Array<string | number>> = [
    [
      "Product",
      "Variant",
      "Category",
      "Qty",
      "Net Sales",
      "COGS",
      "Gross Profit",
      "Margin %",
      "Incomplete",
      "Estimated",
    ],
    ...args.items.map((row) => [
      row.productName,
      row.variantName ?? "",
      row.categoryName ?? "",
      row.qty,
      formatGrossProfitMoney(row.netSales),
      formatGrossProfitMoney(row.cogs, { asDeduction: true }),
      formatGrossProfitMoney(row.grossProfit),
      `${row.marginPct}%`,
      row.cogsIncomplete ? "Yes" : "No",
      row.cogsEstimated ? "Yes" : "No",
    ]),
    [],
    [
      "Total (products)",
      "",
      "",
      itemTotals.qty,
      formatGrossProfitMoney(itemTotals.netSales),
      formatGrossProfitMoney(itemTotals.cogs, { asDeduction: true }),
      formatGrossProfitMoney(itemTotals.grossProfit),
      `${itemTotals.marginPct}%`,
      "",
      "",
    ],
  ];

  if (metrics.nonProductNet > 0.01) {
    const nonProductQty = sumNonProductBreakdownQty(args.nonProductRows ?? []);
    itemRows.push([
      "Non-product (summary)",
      "",
      "",
      nonProductQty > 0 ? nonProductQty : "",
      formatGrossProfitMoney(metrics.nonProductNet),
      "",
      "",
      "",
      "",
      "",
    ]);
    for (const row of args.nonProductRows ?? []) {
      itemRows.push([
        row.lineName,
        row.subName ?? "",
        row.lineKind,
        row.qty,
        formatGrossProfitMoney(row.netSales),
        "",
        "",
        "",
        "",
        "",
      ]);
    }
    itemRows.push([
      "Summary net sales",
      "",
      "",
      "",
      formatGrossProfitMoney(metrics.netSales),
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Gross Profit");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), "Items");
  XLSX.writeFile(wb, `gross-profit-${args.fromYmd}_${args.toYmd}.xlsx`);
}
