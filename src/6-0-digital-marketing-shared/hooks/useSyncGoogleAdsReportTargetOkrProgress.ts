import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncGoogleAdsIndividualObjectiveProgress } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrProgressSync";
import { resolveOkrCycleForGoogleAdsReportPeriod } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrCycleResolver";
import type { GoogleAdsReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useGoogleAdsReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetAccounts";
import { useGoogleAdsReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportPeriodActuals";
import { useGoogleAdsReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportPeriodSettingsQuery";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";
import { supabase } from "@/shared/lib/supabaseClient";

function currentGoogleAdsPeriod(now = new Date()): GoogleAdsReportTargetPeriodKey {
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { periodType: "quarterly", year: now.getFullYear(), quarter };
}

export function useSyncGoogleAdsReportTargetOkrProgress(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);
  const { accounts } = useGoogleAdsReportTargetAccounts();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  const period = currentGoogleAdsPeriod();
  const periodSettingsQuery = useGoogleAdsReportPeriodSettingsQuery(period);
  const selectedMetrics = periodSettingsQuery.data?.selected_metrics ?? [];
  const { actualsByAccount } = useGoogleAdsReportPeriodActuals(period, selectedMetrics, {});

  useEffect(() => {
    if (!enabled || !organizationId || ranRef.current || accounts.length === 0) return;
    if (selectedMetrics.length === 0) return;
    ranRef.current = true;

    const cycle = resolveOkrCycleForGoogleAdsReportPeriod(period, cycles);
    if (!cycle) return;

    void (async () => {
      try {
        const updated = await syncGoogleAdsIndividualObjectiveProgress({
          supabase,
          organizationId,
          period,
          accountActuals: actualsByAccount,
          metricValueKinds: {},
        });
        if (updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["individual-objective-progress"] });
        }
      } catch (e) {
        console.warn("[useSyncGoogleAdsReportTargetOkrProgress]", e);
      }
    })();
  }, [enabled, organizationId, cycles, accounts, selectedMetrics, actualsByAccount, queryClient]);
}
