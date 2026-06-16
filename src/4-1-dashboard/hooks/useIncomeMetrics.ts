
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  computeIncomeMetricsFromSummary,
  fetchIncomeTransactionSummary,
  incomeTransactionSummaryQueryKey,
} from "../lib/incomeTransactionSummary";

export const useIncomeMetrics = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["income-metrics", organizationId],
    queryFn: async () => {
      const rows = await queryClient.ensureQueryData({
        queryKey: incomeTransactionSummaryQueryKey(organizationId),
        queryFn: () => fetchIncomeTransactionSummary(organizationId!),
      });
      return computeIncomeMetricsFromSummary(rows);
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
