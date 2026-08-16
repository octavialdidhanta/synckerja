import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { useMemo } from "react";
import {
  actualsFromAccountRow,
  type PlatformPeriodActuals,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import type { InsightTargetAccountRef } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useSocialMediaInsightTargetAccounts } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAccounts";
import {
  periodKeyToDateRangePayload,
  resolvePeriodKeyToBounds,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import {
  fetchInsightAccountMetrics,
  INSIGHT_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "@/6-0-social-media-performance-shared/fetchInsightAccountMetrics";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { clampTikTokAdsDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

const EMPTY_ACCOUNT_ACTUALS: PlatformPeriodActuals = {
  audience: null,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  avgEngagementRate: null,
  hasConnectedAccount: false,
};

export function useSocialMediaInsightPeriodActuals(period: InsightTargetPeriodKey) {
  const { organizationId } = useCurrentOrg();
  const now = new Date();

  const periodNotStarted = useMemo(() => {
    const bounds = resolvePeriodKeyToBounds(period, now);
    return startOfDay(bounds.periodStart).getTime() > startOfDay(now).getTime();
  }, [period, now]);

  const dateRange = useMemo(() => periodKeyToDateRangePayload(period, now), [period, now]);
  const clampedRange = useMemo(
    () => clampTikTokAdsDateRange(dateRange.start, dateRange.end, now),
    [dateRange.start, dateRange.end, now],
  );

  const { accounts: accountRefs, isLoading: accountsLoading } =
    useSocialMediaInsightTargetAccounts();

  const actualsQuery = useQuery({
    queryKey: socialMediaInsightQueryKeys.periodActuals(
      organizationId,
      period,
      clampedRange.start,
      clampedRange.end,
    ),
    queryFn: async () => {
      const byAccount: Record<string, PlatformPeriodActuals> = {};
      if (!organizationId || periodNotStarted || accountRefs.length === 0) {
        return byAccount;
      }

      const accountRows = await mapWithConcurrency(
        accountRefs,
        INSIGHT_FETCH_CONCURRENCY,
        (account) =>
          fetchInsightAccountMetrics(
            organizationId,
            account,
            clampedRange.start,
            clampedRange.end,
          ),
      );

      for (const row of accountRows) {
        const key = `${row.platform}:${row.accountId}`;
        byAccount[key] = actualsFromAccountRow(row);
      }
      return byAccount;
    },
    enabled: Boolean(organizationId) && !periodNotStarted && !accountsLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const actualsByAccount = actualsQuery.data ?? {};

  return {
    accountRefs,
    actualsByAccount,
    inProgress: dateRange.inProgress,
    periodNotStarted,
    isLoading: accountsLoading || actualsQuery.isLoading,
    wasDateClamped: clampedRange.wasStartClamped,
    getAccountActuals: (account: InsightTargetAccountRef) =>
      actualsByAccount[`${account.platform}:${account.accountId}`] ?? EMPTY_ACCOUNT_ACTUALS,
  };
}
