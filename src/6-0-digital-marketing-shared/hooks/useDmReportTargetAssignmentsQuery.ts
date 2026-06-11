import { useQuery } from "@tanstack/react-query";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import type {
  DmReportTargetAssignmentRow,
  DmReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export function useDmReportTargetAssignmentsQuery(period: DmReportTargetPeriodKey | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: dmReportTargetQueryKeys.assignments(organizationId, period),
    queryFn: async (): Promise<DmReportTargetAssignmentRow[]> => {
      if (!organizationId || !period) return [];

      const filter = periodKeyToQueryFilter(period);
      let query = supabase
        .from("digital_marketing_report_target_assignments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("period_type", filter.period_type)
        .eq("year", filter.year);

      if (filter.period_type === "monthly" && filter.month != null) {
        query = query.eq("month", filter.month);
      }
      if (filter.period_type === "quarterly" && filter.quarter != null) {
        query = query.eq("quarter", filter.quarter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DmReportTargetAssignmentRow[];
    },
    enabled: Boolean(organizationId && period),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
