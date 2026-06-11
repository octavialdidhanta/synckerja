import { useQuery } from "@tanstack/react-query";
import { fetchGoogleAdsWeeklyCumulativeActuals } from "@/6-0-digital-marketing-shared/fetchGoogleAdsReportTargetWeeklyActuals";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import type { GoogleAdsReportTargetRow } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { GoogleAdsWeeklyPeriodInput } from "@/6-0-digital-marketing-shared/fetchGoogleAdsReportTargetWeeklyActuals";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type GoogleAdsWeeklyCheckinContext = {
  targetRow: GoogleAdsReportTargetRow;
  weeklyActuals: Map<string, number | null>;
  periodToDateActual: number | null;
};

export function useGoogleAdsReportTargetWeeklyCheckinActuals(
  objectiveId: string | undefined,
  weeks: GoogleAdsWeeklyPeriodInput[],
  enabled: boolean,
) {
  const { organizationId } = useCurrentOrg();
  const weekKeys = weeks.map((w) => w.weekKey).join(",");

  return useQuery({
    queryKey: googleAdsReportTargetQueryKeys.weeklyCheckinActuals(
      organizationId,
      objectiveId,
      weekKeys,
    ),
    queryFn: async (): Promise<GoogleAdsWeeklyCheckinContext | null> => {
      if (!organizationId || !objectiveId || weeks.length === 0) return null;

      const { data: targetRow, error } = await supabase
        .from("google_ads_report_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("individual_objective_id", objectiveId)
        .maybeSingle();

      if (error) throw error;
      if (!targetRow) return null;

      const weeklyActuals = await fetchGoogleAdsWeeklyCumulativeActuals({
        organizationId,
        targetRow: targetRow as GoogleAdsReportTargetRow,
        weeks,
      });

      let periodToDateActual: number | null = null;
      const editableWeeks = weeks.filter((w) => !w.isFuture);
      if (editableWeeks.length > 0) {
        const latestKey = editableWeeks[0]?.weekKey;
        if (latestKey) {
          periodToDateActual = weeklyActuals.get(latestKey) ?? null;
        }
      }

      return {
        targetRow: targetRow as GoogleAdsReportTargetRow,
        weeklyActuals,
        periodToDateActual,
      };
    },
    enabled: Boolean(organizationId && objectiveId && enabled && weeks.length > 0),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
