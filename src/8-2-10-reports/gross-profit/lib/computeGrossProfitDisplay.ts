import type { GrossProfitMetrics } from "./grossProfitTypes";
import { EMPTY_GROSS_PROFIT } from "./grossProfitTypes";

export function normalizeGrossProfitMetrics(
  row: Partial<Record<string, unknown>> | null | undefined,
): GrossProfitMetrics {
  if (!row) return { ...EMPTY_GROSS_PROFIT };
  const num = (key: string) => {
    const v = Number(row[key] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  const discounts = num("discounts");
  const netSales = num("net_sales");
  const grossFromRpc = num("gross_sales");
  const cogs = num("cogs");
  const cogsAdjustment = num("cogs_adjustment");
  const cogsReversed = num("cogs_reversed");
  const grossProfitFromRpc = num("gross_profit");
  const grossProfit =
    Number.isFinite(Number(row.gross_profit)) && row.gross_profit != null
      ? grossProfitFromRpc
      : netSales - cogs - cogsAdjustment;
  const marginFromRpc = num("gross_profit_margin");
  const grossProfitMargin =
    row.gross_profit_margin != null && Number.isFinite(Number(row.gross_profit_margin))
      ? marginFromRpc
      : netSales > 0
        ? Math.round(((grossProfit / netSales) * 100) * 100) / 100
        : 0;

  const productNetFromRpc = row.product_net_sales;
  const nonProductFromRpc = row.non_product_net;
  const hasProductNetField =
    productNetFromRpc != null && Number.isFinite(Number(productNetFromRpc));
  const hasNonProductField =
    nonProductFromRpc != null && Number.isFinite(Number(nonProductFromRpc));

  const productNetSales = hasProductNetField ? num("product_net_sales") : netSales;
  const nonProductNet = hasNonProductField
    ? num("non_product_net")
    : Math.max(0, netSales - productNetSales);

  return {
    grossSales:
      grossFromRpc > 0 || discounts > 0 || netSales > 0
        ? grossFromRpc || netSales + discounts
        : 0,
    discounts,
    refunds: num("refunds"),
    netSales,
    productNetSales: hasProductNetField ? productNetSales : Math.max(0, netSales - nonProductNet),
    nonProductNet,
    gratuity: num("gratuity"),
    tax: num("tax"),
    cogs,
    cogsAdjustment,
    cogsReversed,
    grossProfit,
    grossProfitMargin,
    cogsIncomplete: Boolean(row.cogs_incomplete),
    transactionCount: Math.max(0, Math.round(num("transaction_count"))),
  };
}

export { formatReportsMoney as formatGrossProfitMoney } from "../../shared/lib/formatReportsMoney";
