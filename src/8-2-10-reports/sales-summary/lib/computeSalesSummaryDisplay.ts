import type { SalesSummaryMetrics } from "./salesSummaryTypes";
import { EMPTY_SALES_SUMMARY } from "./salesSummaryTypes";

export function normalizeSalesSummaryMetrics(
  row: Partial<Record<string, unknown>> | null | undefined,
): SalesSummaryMetrics {
  if (!row) return { ...EMPTY_SALES_SUMMARY };
  const num = (key: string) => {
    const v = Number(row[key] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  const discounts = num("discounts");
  const netSales = num("net_sales");
  const grossFromRpc = num("gross_sales");
  return {
    grossSales: grossFromRpc > 0 || discounts > 0 || netSales > 0 ? grossFromRpc || netSales + discounts : 0,
    discounts,
    refunds: num("refunds"),
    netSales,
    gratuity: num("gratuity"),
    tax: num("tax"),
    rounding: num("rounding"),
    totalCollected: num("total_collected"),
    transactionCount: Math.max(0, Math.round(num("transaction_count"))),
  };
}

/** Moka-style: Net Sales + Gratuity + Tax + Rounding = Total Collected. */
export function computeExpectedTotalCollected(
  metrics: Pick<SalesSummaryMetrics, "netSales" | "gratuity" | "tax" | "rounding">,
): number {
  return metrics.netSales + metrics.gratuity + metrics.tax + metrics.rounding;
}

export function salesSummaryTotalsMismatch(
  metrics: Pick<SalesSummaryMetrics, "totalCollected" | "netSales" | "gratuity" | "tax" | "rounding">,
  epsilon = 0.01,
): boolean {
  return Math.abs(computeExpectedTotalCollected(metrics) - metrics.totalCollected) > epsilon;
}

/** Format Rp for summary rows; deductions render as (Rp. …). */
export function formatSalesSummaryMoney(amount: number, opts?: { asDeduction?: boolean }): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  const withDot = formatted.replace(/^Rp\s?/, "Rp. ");
  if (opts?.asDeduction && abs > 0) return `(${withDot})`;
  return withDot;
}
