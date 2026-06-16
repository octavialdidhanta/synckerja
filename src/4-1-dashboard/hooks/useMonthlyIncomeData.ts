import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  computeMonthlyIncomeDataFromSummary,
  fetchIncomeTransactionSummary,
  incomeTransactionSummaryQueryKey,
} from "../lib/incomeTransactionSummary";

export const useMonthlyIncomeData = (year?: string) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const selectedYear = year || new Date().getFullYear().toString();

  return useQuery({
    queryKey: ["monthly-income-data", organizationId, selectedYear],
    queryFn: async () => {
      const rows = await queryClient.ensureQueryData({
        queryKey: incomeTransactionSummaryQueryKey(organizationId),
        queryFn: () => fetchIncomeTransactionSummary(organizationId!),
      });
      return computeMonthlyIncomeDataFromSummary(rows, selectedYear);
    },
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
