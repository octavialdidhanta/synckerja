import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncDmIndividualObjectiveProgress } from "@/6-0-digital-marketing-shared/dmReportTargetOkrProgressSync";
import { resolveOkrCycleForDmReportPeriod } from "@/6-0-digital-marketing-shared/dmReportTargetOkrCycleResolver";
import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { unionChannelMetrics } from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { useDmReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetAccounts";
import { useDmReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodActuals";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";
import { supabase } from "@/shared/lib/supabaseClient";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

function currentDmPeriod(now = new Date()): DmReportTargetPeriodKey {
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { periodType: "quarterly", year: now.getFullYear(), quarter };
}

export function useSyncDmReportTargetOkrProgress(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);
  const { accounts } = useDmReportTargetAccounts();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  const period = currentDmPeriod();
  const periodSettingsQuery = useDmReportPeriodSettingsQuery(period);
  const selectedMetricsByChannel =
    periodSettingsQuery.data?.selected_metrics_by_channel ?? {
      google: [],
      meta: [],
      tiktok: [],
    };
  const selectedMetrics = unionChannelMetrics(selectedMetricsByChannel);
  const { actualsByAccount } = useDmReportPeriodActuals(period, selectedMetricsByChannel);

  const metricValueKinds = Object.fromEntries(
    (selectedMetrics as ReportTableMetricKey[]).map((k) => [k, reportMetricValueKind(k)]),
  );

  useEffect(() => {
    if (!enabled || !organizationId || ranRef.current || accounts.length === 0) return;
    if (selectedMetrics.length === 0) return;
    ranRef.current = true;

    const cycle = resolveOkrCycleForDmReportPeriod(period, cycles);
    if (!cycle) return;

    void (async () => {
      try {
        const updated = await syncDmIndividualObjectiveProgress({
          supabase,
          organizationId,
          period,
          accountActuals: actualsByAccount,
          metricValueKinds,
          metricDirections: periodSettingsQuery.data?.metric_directions ?? {},
        });
        if (updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["individual-objective-progress"] });
          queryClient.invalidateQueries({
            queryKey: dmReportTargetQueryKeys.objectiveProgress(organizationId),
          });
        }
      } catch (e) {
        console.warn("[useSyncDmReportTargetOkrProgress]", e);
      }
    })();
  }, [
    enabled,
    organizationId,
    cycles,
    accounts,
    selectedMetrics,
    actualsByAccount,
    queryClient,
    metricValueKinds,
    period,
  ]);
}
