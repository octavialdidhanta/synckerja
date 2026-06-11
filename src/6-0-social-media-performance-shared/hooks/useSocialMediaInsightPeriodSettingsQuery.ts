import { useQuery } from "@tanstack/react-query";
import { periodKeyToQueryFilter } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type {
  InsightTargetPeriodKey,
  SocialMediaInsightTargetPeriodSettingsRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export function useSocialMediaInsightPeriodSettingsQuery(period: InsightTargetPeriodKey | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: socialMediaInsightQueryKeys.periodSettings(organizationId, period),
    queryFn: async (): Promise<SocialMediaInsightTargetPeriodSettingsRow | null> => {
      if (!organizationId || !period) return null;

      const filter = periodKeyToQueryFilter(period);
      let query = supabase
        .from("social_media_insight_target_period_settings")
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
      return (data as SocialMediaInsightTargetPeriodSettingsRow | null) ?? null;
    },
    enabled: Boolean(organizationId && period),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
