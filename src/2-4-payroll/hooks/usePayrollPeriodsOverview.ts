import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export interface PayrollPeriodOverview {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export const payrollPeriodsOverviewQueryKey = (organizationId?: string | null) =>
  ["payroll-periods-overview", organizationId] as const;

export function usePayrollPeriodsOverview(organizationId: string | null) {
  return useQuery({
    queryKey: payrollPeriodsOverviewQueryKey(organizationId),
    queryFn: async () => {
      if (!organizationId) return [] as PayrollPeriodOverview[];

      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []) as PayrollPeriodOverview[];
    },
    enabled: !!organizationId,
  });
}
