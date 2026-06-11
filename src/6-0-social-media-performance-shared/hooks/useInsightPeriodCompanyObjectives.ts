import { useQuery } from "@tanstack/react-query";
import { fetchActiveCompanyObjectivesForCycle } from "@/6-0-social-media-performance-shared/fetchActiveCompanyObjectivesForCycle";
import { resolveOkrCycleForInsightPeriod } from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";

export function useInsightPeriodCompanyObjectives(period: InsightTargetPeriodKey | null) {
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [], isLoading: cyclesLoading } = useOkrCycles(organizationId ?? undefined);

  const resolvedCycle = period
    ? resolveOkrCycleForInsightPeriod(period, cycles)
    : null;

  const objectivesQuery = useQuery({
    queryKey: [
      "insight-period-company-objectives",
      organizationId,
      resolvedCycle?.id ?? null,
    ],
    queryFn: async () => {
      if (!organizationId || !resolvedCycle?.id) return [];
      return fetchActiveCompanyObjectivesForCycle(organizationId, resolvedCycle.id);
    },
    enabled: Boolean(organizationId && resolvedCycle?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    objectives: objectivesQuery.data ?? [],
    resolvedCycle,
    isLoading: cyclesLoading || objectivesQuery.isLoading,
    error: objectivesQuery.error,
    hasMatchingCycle: Boolean(resolvedCycle?.id),
  };
}
