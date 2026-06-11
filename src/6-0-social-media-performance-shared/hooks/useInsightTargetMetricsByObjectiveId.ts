import { useQuery } from "@tanstack/react-query";
import { insightKeyResultUnit } from "@/6-0-social-media-performance-shared/insightTargetOkrProgress";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type { SocialMediaInsightTargetRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type InsightObjectiveMetricDisplay = {
  objectiveId: string;
  targetValue: number;
  unit: string;
  metric: string;
  platform: string;
  accountId: string;
};

function rowToDisplay(row: SocialMediaInsightTargetRow): InsightObjectiveMetricDisplay | null {
  if (!row.individual_objective_id) return null;
  return {
    objectiveId: row.individual_objective_id,
    targetValue: Number(row.target_value),
    unit: insightKeyResultUnit(row.metric),
    metric: row.metric,
    platform: row.platform,
    accountId: row.account_id,
  };
}

export function useInsightTargetMetricsByObjectiveId() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: socialMediaInsightQueryKeys.insightMetricsByObjective(organizationId),
    queryFn: async (): Promise<Map<string, InsightObjectiveMetricDisplay>> => {
      if (!organizationId) return new Map();

      const { data, error } = await supabase
        .from("social_media_insight_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .not("individual_objective_id", "is", null);

      if (error) throw error;

      const map = new Map<string, InsightObjectiveMetricDisplay>();
      for (const row of (data ?? []) as SocialMediaInsightTargetRow[]) {
        const display = rowToDisplay(row);
        if (display) map.set(display.objectiveId, display);
      }
      return map;
    },
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
