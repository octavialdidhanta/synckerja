import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchInsightPeriodActualsByAccount } from "@/6-0-social-media-performance-shared/fetchInsightPeriodActualsByAccount";
import { syncInsightIndividualObjectiveProgress } from "@/6-0-social-media-performance-shared/insightTargetOkrProgressSync";
import { resolveOkrCycleForInsightPeriod } from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useSocialMediaInsightTargetAccounts } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAccounts";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";
import { supabase } from "@/shared/lib/supabaseClient";

function currentInsightPeriod(now = new Date()): InsightTargetPeriodKey {
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { periodType: "quarterly", year: now.getFullYear(), quarter };
}

/** Silent one-way sync of insight actuals into linked OKR individual objectives. */
export function useSyncInsightTargetOkrProgress(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);
  const { accounts } = useSocialMediaInsightTargetAccounts();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || !organizationId || ranRef.current || accounts.length === 0) return;
    ranRef.current = true;

    const period = currentInsightPeriod();
    const cycle = resolveOkrCycleForInsightPeriod(period, cycles);
    if (!cycle) return;

    void (async () => {
      try {
        const actuals = await fetchInsightPeriodActualsByAccount({
          organizationId,
          period,
          accounts,
        });
        const updated = await syncInsightIndividualObjectiveProgress({
          supabase,
          organizationId,
          period,
          accounts,
          accountActuals: actuals,
        });
        if (updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
          queryClient.invalidateQueries({ queryKey: ["individual-objective-progress"] });
          queryClient.invalidateQueries({
            queryKey: ["social-media-insight-weekly-checkin-actuals"],
          });
        }
      } catch (e) {
        console.warn("[useSyncInsightTargetOkrProgress]", e);
      }
    })();
  }, [enabled, organizationId, cycles, accounts, queryClient]);
}
