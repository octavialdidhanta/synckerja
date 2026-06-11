import { useQuery } from "@tanstack/react-query";
import { parseMetricDirectionsFromSettings } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { parseChannelMetricsFromSettings } from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import type {
  DmReportTargetPeriodKey,
  DmReportTargetPeriodSettingsRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

function normalizePeriodSettingsRow(
  raw: Record<string, unknown> | null,
): DmReportTargetPeriodSettingsRow | null {
  if (!raw) return null;
  const legacy = (raw.selected_metrics as string[] | null) ?? [];
  return {
    ...(raw as DmReportTargetPeriodSettingsRow),
    selected_metrics: legacy,
    selected_metrics_by_channel: parseChannelMetricsFromSettings(
      raw.selected_metrics_by_channel,
      legacy,
    ),
    metric_directions: parseMetricDirectionsFromSettings(raw.metric_directions),
  };
}

export function useDmReportPeriodSettingsQuery(period: DmReportTargetPeriodKey | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: dmReportTargetQueryKeys.periodSettings(organizationId, period),
    queryFn: async (): Promise<DmReportTargetPeriodSettingsRow | null> => {
      if (!organizationId || !period) return null;

      const filter = periodKeyToQueryFilter(period);
      let query = supabase
        .from("digital_marketing_report_target_period_settings")
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
      return normalizePeriodSettingsRow(data as Record<string, unknown> | null);
    },
    enabled: Boolean(organizationId && period),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
