import { useEffect, useMemo } from "react";
import { useGrossProfitReport } from "@/8-2-10-reports/gross-profit/hooks/useGrossProfitReport";
import { useSalesSummaryReport } from "@/8-2-10-reports/sales-summary/hooks/useSalesSummaryReport";
import { averageSalePerTransaction } from "../../shared/lib/dashboardMetricFormat";

export type UseDashboardSummaryMetricsArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useDashboardSummaryMetrics(args: UseDashboardSummaryMetricsArgs) {
  const sales = useSalesSummaryReport(args);
  const profit = useGrossProfitReport(args);
  const refetchSales = sales.refetch;
  const refetchProfit = profit.refetch;

  useEffect(() => {
    if (args.enabled === false) return;
    const timer = window.setInterval(() => {
      void refetchSales();
      void refetchProfit();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [args.enabled, refetchProfit, refetchSales]);

  const metrics = useMemo(() => ({
    grossSales: sales.metrics.grossSales,
    netSales: sales.metrics.netSales,
    grossProfit: profit.metrics.grossProfit,
    transactionCount: sales.metrics.transactionCount,
    avgSale: averageSalePerTransaction(
      sales.metrics.netSales,
      sales.metrics.transactionCount,
    ),
    grossMargin: profit.metrics.grossProfitMargin,
  }), [profit.metrics, sales.metrics]);

  return {
    metrics,
    isLoading: sales.isLoading || profit.isLoading,
    isFetching: sales.isFetching || profit.isFetching,
    isError: sales.isError || profit.isError,
    error: sales.error ?? profit.error,
    refetch: async () => Promise.all([refetchSales(), refetchProfit()]),
  };
}

export type DashboardSummaryMetrics = ReturnType<
  typeof useDashboardSummaryMetrics
>["metrics"];
