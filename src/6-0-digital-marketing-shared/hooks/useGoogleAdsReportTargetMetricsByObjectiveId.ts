import { useQuery } from "@tanstack/react-query";
import { googleAdsKeyResultUnit } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrProgress";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import type { GoogleAdsReportTargetRow } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetricValueKind } from "@/google-ads/metrics/types";

export type GoogleAdsObjectiveMetricDisplay = {
  objectiveId: string;
  targetValue: number;
  unit: string;
  metricKey: string;
  customerId: string;
};

function rowToDisplay(
  row: GoogleAdsReportTargetRow,
  valueKind: MetricValueKind = "count",
): GoogleAdsObjectiveMetricDisplay | null {
  if (!row.individual_objective_id) return null;
  return {
    objectiveId: row.individual_objective_id,
    targetValue: Number(row.target_value),
    unit: googleAdsKeyResultUnit(row.metric_key, valueKind),
    metricKey: row.metric_key,
    customerId: row.google_customer_id,
  };
}

export function useGoogleAdsReportTargetMetricsByObjectiveId() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: googleAdsReportTargetQueryKeys.metricsByObjective(organizationId),
    queryFn: async (): Promise<Map<string, GoogleAdsObjectiveMetricDisplay>> => {
      if (!organizationId) return new Map();

      const { data, error } = await supabase
        .from("google_ads_report_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .not("individual_objective_id", "is", null);

      if (error) throw error;

      const map = new Map<string, GoogleAdsObjectiveMetricDisplay>();
      for (const row of (data ?? []) as GoogleAdsReportTargetRow[]) {
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
