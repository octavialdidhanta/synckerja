import { useQuery } from "@tanstack/react-query";
import { dmKeyResultUnit } from "@/6-0-digital-marketing-shared/dmReportTargetOkrProgress";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import type { DmReportTargetRow } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

export type DmObjectiveMetricDisplay = {
  objectiveId: string;
  targetValue: number;
  unit: string;
  metricKey: string;
  channel: string;
  accountId: string;
};

function rowToDisplay(row: DmReportTargetRow): DmObjectiveMetricDisplay | null {
  if (!row.individual_objective_id) return null;
  const valueKind = reportMetricValueKind(row.metric_key as ReportTableMetricKey);
  return {
    objectiveId: row.individual_objective_id,
    targetValue: Number(row.target_value),
    unit: dmKeyResultUnit(row.metric_key, valueKind),
    metricKey: row.metric_key,
    channel: row.channel,
    accountId: row.account_id,
  };
}

export function useDmReportTargetMetricsByObjectiveId() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: dmReportTargetQueryKeys.metricsByObjective(organizationId),
    queryFn: async (): Promise<Map<string, DmObjectiveMetricDisplay>> => {
      if (!organizationId) return new Map();

      const { data, error } = await supabase
        .from("digital_marketing_report_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .not("individual_objective_id", "is", null);

      if (error) throw error;

      const map = new Map<string, DmObjectiveMetricDisplay>();
      for (const row of (data ?? []) as DmReportTargetRow[]) {
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
