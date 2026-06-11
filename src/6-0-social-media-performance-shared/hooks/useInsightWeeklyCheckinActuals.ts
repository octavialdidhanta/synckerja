import { useQuery } from "@tanstack/react-query";
import {
  fetchInsightWeeklyCumulativeActuals,
  type InsightWeeklyPeriodInput,
} from "@/6-0-social-media-performance-shared/fetchInsightWeeklyCumulativeActuals";
import { useSocialMediaInsightTargetAccounts } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAccounts";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type { SocialMediaInsightTargetRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type InsightWeeklyCheckinContext = {
  targetRow: SocialMediaInsightTargetRow;
  weeklyActuals: Map<string, number | null>;
  periodToDateActual: number | null;
};

export function useInsightWeeklyCheckinActuals(
  objectiveId: string | undefined,
  weeks: InsightWeeklyPeriodInput[],
  enabled: boolean,
) {
  const { organizationId } = useCurrentOrg();
  const { accounts } = useSocialMediaInsightTargetAccounts();
  const weekKeys = weeks.map((w) => w.weekKey).join(",");

  return useQuery({
    queryKey: socialMediaInsightQueryKeys.weeklyCheckinActuals(
      organizationId,
      objectiveId,
      weekKeys,
    ),
    queryFn: async (): Promise<InsightWeeklyCheckinContext | null> => {
      if (!organizationId || !objectiveId || weeks.length === 0) return null;

      const { data: targetRow, error } = await supabase
        .from("social_media_insight_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("individual_objective_id", objectiveId)
        .maybeSingle();

      if (error) throw error;
      if (!targetRow) return null;

      const accountRef = accounts.find(
        (a) => a.platform === targetRow.platform && a.accountId === targetRow.account_id,
      );

      const weeklyActuals = await fetchInsightWeeklyCumulativeActuals({
        organizationId,
        targetRow: targetRow as SocialMediaInsightTargetRow,
        accountLabel: accountRef?.accountLabel,
        avatarUrl: accountRef?.avatarUrl ?? null,
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
        targetRow: targetRow as SocialMediaInsightTargetRow,
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
