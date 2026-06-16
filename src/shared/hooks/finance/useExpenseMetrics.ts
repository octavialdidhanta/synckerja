import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { computeExpenseMetricsFromSummary, fetchExpenseSummaryRows } from "./expenseSummary";

export const useExpenseMetrics = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ["expense-metrics", organizationId],
    queryFn: async () => {
      const rows = await fetchExpenseSummaryRows(organizationId!);
      return computeExpenseMetricsFromSummary(rows);
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
