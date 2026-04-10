import { useMemo } from "react";
import { useIncomeMetrics } from "@/features/4-1-dashboard/hooks/useIncomeMetrics";

export function useIncomeTransactionDashboardStats() {
  const { data: metrics, isLoading } = useIncomeMetrics();

  const thisMonthRevenue = useMemo(
    () => Number(metrics?.currentMonthTotal || 0),
    [metrics?.currentMonthTotal]
  );
  const totalTransactions = useMemo(
    () => Number(metrics?.totalTransactions || 0),
    [metrics?.totalTransactions]
  );
  const thisYearRevenue = useMemo(
    () => Number(metrics?.yearTotal || 0),
    [metrics?.yearTotal]
  );
  const monthlyAverage = useMemo(
    () => Number(metrics?.yearTotal || 0) / (new Date().getMonth() + 1),
    [metrics?.yearTotal]
  );
  const growthPercentage = useMemo(
    () => Number(metrics?.growthPercentage || 0),
    [metrics?.growthPercentage]
  );
  const currentMonthTransactionCount = useMemo(
    () => Number(metrics?.currentMonthTransactionCount || 0),
    [metrics?.currentMonthTransactionCount]
  );

  return {
    isLoading,
    thisMonthRevenue,
    totalTransactions,
    thisYearRevenue,
    monthlyAverage,
    growthPercentage,
    currentMonthTransactionCount,
  };
}
