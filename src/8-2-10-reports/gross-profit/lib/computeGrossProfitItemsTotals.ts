import type { GrossProfitItemRow } from "./grossProfitItemTypes";
import type { GrossProfitMetrics } from "./grossProfitTypes";

export type GrossProfitItemTotals = {
  qty: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
};

export type GrossProfitItemsFooterState = {
  itemTotals: GrossProfitItemTotals;
  nonProductNet: number;
  summaryNetSales: number;
  productNetSales: number;
  showNonProductRow: boolean;
  matchesSummary: boolean;
  productNetMatchesItems: boolean;
};

export function computeItemTotalsMarginPct(
  totals: Pick<GrossProfitItemTotals, "netSales" | "grossProfit">,
): number {
  if (totals.netSales <= 0) return 0;
  return Math.round(((totals.grossProfit / totals.netSales) * 100) * 100) / 100;
}

export function sumGrossProfitItemRows(items: GrossProfitItemRow[]): GrossProfitItemTotals {
  const summed = items.reduce(
    (acc, row) => ({
      qty: acc.qty + row.qty,
      netSales: acc.netSales + row.netSales,
      cogs: acc.cogs + row.cogs,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    { qty: 0, netSales: 0, cogs: 0, grossProfit: 0 },
  );
  return {
    ...summed,
    marginPct: computeItemTotalsMarginPct(summed),
  };
}

export function amountsDiffer(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(a - b) > epsilon;
}

export function itemsNetDiffersFromSummary(
  itemsNet: number,
  summaryNet: number,
  epsilon = 0.01,
): boolean {
  return amountsDiffer(itemsNet, summaryNet, epsilon);
}

export function buildGrossProfitItemsFooterState(args: {
  items: GrossProfitItemRow[];
  metrics: Pick<GrossProfitMetrics, "netSales" | "productNetSales" | "nonProductNet">;
}): GrossProfitItemsFooterState {
  const itemTotals = sumGrossProfitItemRows(args.items);
  const { netSales, productNetSales, nonProductNet } = args.metrics;
  const showNonProductRow = nonProductNet > 0.01;
  const productNetMatchesItems = !amountsDiffer(itemTotals.netSales, productNetSales);
  const matchesSummary =
    !amountsDiffer(itemTotals.netSales + nonProductNet, netSales) && productNetMatchesItems;

  return {
    itemTotals,
    nonProductNet,
    summaryNetSales: netSales,
    productNetSales,
    showNonProductRow,
    matchesSummary,
    productNetMatchesItems,
  };
}
