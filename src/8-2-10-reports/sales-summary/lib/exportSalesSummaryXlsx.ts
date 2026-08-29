import * as XLSX from "xlsx";
import type { SalesSummaryMetrics } from "./salesSummaryTypes";
import { formatSalesSummaryMoney } from "./computeSalesSummaryDisplay";

export function exportSalesSummaryXlsx(args: {
  metrics: SalesSummaryMetrics;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
  filename?: string;
}): void {
  const { metrics } = args;
  const rows: Array<[string, string] | []> = [
    ["Outlet", args.outletLabel],
    ["From", args.fromYmd],
    ["To", args.toYmd],
    ["Transactions", String(metrics.transactionCount)],
    [],
    ["Metric", "Amount"],
    ["Gross Sales", formatSalesSummaryMoney(metrics.grossSales)],
    ["Discounts", formatSalesSummaryMoney(metrics.discounts, { asDeduction: true })],
    ["Refunds", formatSalesSummaryMoney(metrics.refunds, { asDeduction: true })],
    ["Net Sales", formatSalesSummaryMoney(metrics.netSales)],
    ["Gratuity", formatSalesSummaryMoney(metrics.gratuity)],
    ["Tax", formatSalesSummaryMoney(metrics.tax)],
    ["Rounding", formatSalesSummaryMoney(metrics.rounding, { asDeduction: true })],
    ["Total Collected", formatSalesSummaryMoney(metrics.totalCollected)],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sales Summary");
  const filename = args.filename ?? `sales-summary-${args.fromYmd}_${args.toYmd}.xlsx`;
  XLSX.writeFile(wb, filename);
}
