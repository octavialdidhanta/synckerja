import type { GrossProfitMetrics } from "./grossProfitTypes";

export type GrossProfitWaterfallRowKind =
  | "grossSales"
  | "discounts"
  | "refunds"
  | "netSales"
  | "nonProductNet"
  | "cogs"
  | "cogsAdjustment"
  | "cogsReversed"
  | "grossProfit";

export type GrossProfitWaterfallRow = {
  kind: GrossProfitWaterfallRowKind;
  amount: number;
  asDeduction?: boolean;
  emphasize?: boolean;
  highlight?: boolean;
  showInfoTooltip?: boolean;
  informational?: boolean;
  percent: number | null;
  percentVariant?: "net" | "cogs" | "profit";
};

const EPSILON = 0.01;

export function shouldShowNonProductRow(nonProductNet: number, epsilon = EPSILON): boolean {
  return nonProductNet > epsilon;
}

export function shouldShowAmountRow(amount: number, epsilon = EPSILON): boolean {
  return Math.abs(amount) > epsilon;
}

export function computeWaterfallPercent(
  metrics: Pick<
    GrossProfitMetrics,
    "netSales" | "cogs" | "cogsAdjustment" | "cogsReversed" | "grossProfitMargin"
  >,
  kind: GrossProfitWaterfallRowKind,
): { percent: number | null; variant?: "net" | "cogs" | "profit" } {
  const { netSales, cogs, cogsAdjustment, cogsReversed, grossProfitMargin } = metrics;
  if (netSales <= 0) return { percent: null };

  switch (kind) {
    case "netSales":
      return { percent: 100, variant: "net" };
    case "cogs":
      return {
        percent: Math.round((cogs / netSales) * 10000) / 100,
        variant: "cogs",
      };
    case "cogsAdjustment":
      return {
        percent: Math.round((Math.abs(cogsAdjustment) / netSales) * 10000) / 100,
        variant: "cogs",
      };
    case "cogsReversed":
      return {
        percent: Math.round((Math.abs(cogsReversed) / netSales) * 10000) / 100,
        variant: "cogs",
      };
    case "grossProfit":
      return { percent: grossProfitMargin, variant: "profit" };
    default:
      return { percent: null };
  }
}

export function buildGrossProfitWaterfallRows(metrics: GrossProfitMetrics): GrossProfitWaterfallRow[] {
  const baseRows: Array<Omit<GrossProfitWaterfallRow, "percent" | "percentVariant">> = [
    { kind: "grossSales", amount: metrics.grossSales },
    { kind: "discounts", amount: metrics.discounts, asDeduction: true },
    { kind: "refunds", amount: metrics.refunds, asDeduction: true, showInfoTooltip: true },
    { kind: "netSales", amount: metrics.netSales, emphasize: true },
  ];

  if (shouldShowNonProductRow(metrics.nonProductNet)) {
    baseRows.push({ kind: "nonProductNet", amount: metrics.nonProductNet });
  }

  baseRows.push({ kind: "cogs", amount: metrics.cogs, asDeduction: true });

  if (shouldShowAmountRow(metrics.cogsAdjustment)) {
    baseRows.push({
      kind: "cogsAdjustment",
      amount: metrics.cogsAdjustment,
      asDeduction: true,
      showInfoTooltip: true,
    });
  }

  if (shouldShowAmountRow(metrics.cogsReversed)) {
    baseRows.push({
      kind: "cogsReversed",
      amount: metrics.cogsReversed,
      informational: true,
      showInfoTooltip: true,
    });
  }

  baseRows.push({
    kind: "grossProfit",
    amount: metrics.grossProfit,
    emphasize: true,
    highlight: true,
  });

  return baseRows.map((row) => {
    const { percent, variant } = computeWaterfallPercent(metrics, row.kind);
    return { ...row, percent, percentVariant: variant };
  });
}
