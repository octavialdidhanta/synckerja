import { useQuery } from "@tanstack/react-query";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import type {
  GoogleAdsReportTargetPeriodKey,
  GoogleAdsReportTargetPeriodSettingsRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export function useGoogleAdsReportPeriodSettingsQuery(
  period: GoogleAdsReportTargetPeriodKey | null,
) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: googleAdsReportTargetQueryKeys.periodSettings(organizationId, period),
    queryFn: async (): Promise<GoogleAdsReportTargetPeriodSettingsRow | null> => {
      if (!organizationId || !period) return null;

      const filter = periodKeyToQueryFilter(period);
      let query = supabase
        .from("google_ads_report_target_period_settings")
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

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as GoogleAdsReportTargetPeriodSettingsRow),
        selected_metrics: (data.selected_metrics as string[] | null) ?? [],
      };
    },
    enabled: Boolean(organizationId && period),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
