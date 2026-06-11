import { useQuery } from "@tanstack/react-query";
import {
  parseMetricDirectionsFromSettings,
  type DmReportMetricDirectionsMap,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { dmTargetRowToPeriodKey } from "@/6-0-digital-marketing-shared/fetchDmReportTargetWeeklyActuals";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  fetchDmWeeklyCumulativeActuals,
  type DmWeeklyPeriodInput,
} from "@/6-0-digital-marketing-shared/fetchDmReportTargetWeeklyActuals";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import type { DmReportTargetRow } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type DmWeeklyCheckinContext = {
  targetRow: DmReportTargetRow;
  weeklyActuals: Map<string, number | null>;
  periodToDateActual: number | null;
  metricDirections: DmReportMetricDirectionsMap;
};

export function useDmReportTargetWeeklyCheckinActuals(
  objectiveId: string | undefined,
  weeks: DmWeeklyPeriodInput[],
  enabled: boolean,
) {
  const { organizationId } = useCurrentOrg();
  const weekKeys = weeks.map((w) => w.weekKey).join(",");

  return useQuery({
    queryKey: dmReportTargetQueryKeys.weeklyCheckinActuals(
      organizationId,
      objectiveId,
      weekKeys,
    ),
    queryFn: async (): Promise<DmWeeklyCheckinContext | null> => {
      if (!organizationId || !objectiveId || weeks.length === 0) return null;

      const { data: targetRow, error } = await supabase
        .from("digital_marketing_report_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("individual_objective_id", objectiveId)
        .maybeSingle();

      if (error) throw error;
      if (!targetRow) return null;

      const typedRow = targetRow as DmReportTargetRow;
      const period = dmTargetRowToPeriodKey(typedRow);
      const filter = periodKeyToQueryFilter(period);

      let settingsQuery = supabase
        .from("digital_marketing_report_target_period_settings")
        .select("metric_directions")
        .eq("organization_id", organizationId)
        .eq("period_type", filter.period_type)
        .eq("year", filter.year);

      if (filter.period_type === "monthly" && filter.month != null) {
        settingsQuery = settingsQuery.eq("month", filter.month);
      }
      if (filter.period_type === "quarterly" && filter.quarter != null) {
        settingsQuery = settingsQuery.eq("quarter", filter.quarter);
      }

      const { data: settingsRow } = await settingsQuery.maybeSingle();
      const metricDirections = parseMetricDirectionsFromSettings(settingsRow?.metric_directions);

      const weeklyActuals = await fetchDmWeeklyCumulativeActuals({
        organizationId,
        targetRow: typedRow,
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
        targetRow: typedRow,
        weeklyActuals,
        periodToDateActual,
        metricDirections,
      };
    },
    enabled: Boolean(organizationId && objectiveId && enabled && weeks.length > 0),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
