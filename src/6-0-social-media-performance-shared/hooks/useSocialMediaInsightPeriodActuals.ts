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
  buildPlatformPlaceholderRow,
  normalizeLinkedInMetrics,
  normalizeTikTokMetrics,
  normalizeYouTubeMetrics,
} from "@/6-0-social-media-performance-shared/socialMediaInsightNormalize";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SocialMediaInsightAccountRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { fetchLinkedInContentPosts } from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import { fetchTikTokContentVideos } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import { clampTikTokAdsDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { fetchYouTubeContentVideos } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

const CONCURRENCY = 4;

type FetchTarget =
  | { platform: "tiktok"; accountId: string; avatarUrl: string | null }
  | { platform: "youtube"; accountId: string; avatarUrl: string | null }
  | { platform: "linkedin"; accountId: string; avatarUrl: string | null };

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchAccountMetrics(
  organizationId: string,
  target: FetchTarget,
  dateStart: string,
  dateEnd: string,
): Promise<SocialMediaInsightAccountRow> {
  try {
    if (target.platform === "tiktok") {
      const payload = await fetchTikTokContentVideos({
        organizationId,
        openId: target.accountId,
        dateStart,
        dateEnd,
        forceRefresh: false,
      });
      return normalizeTikTokMetrics(payload, target.avatarUrl).account;
    }
    if (target.platform === "youtube") {
      const payload = await fetchYouTubeContentVideos({
        organizationId,
        channelId: target.accountId,
        dateStart,
        dateEnd,
        forceRefresh: false,
      });
      return normalizeYouTubeMetrics(payload, target.avatarUrl).account;
    }
    const payload = await fetchLinkedInContentPosts({
      organizationId,
      pageId: target.accountId,
      dateStart,
      dateEnd,
      forceRefresh: false,
    });
    return normalizeLinkedInMetrics(payload, target.avatarUrl).account;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const placeholder = buildPlatformPlaceholderRow(target.platform);
    return {
      ...placeholder,
      accountId: target.accountId,
      connected: true,
      loading: false,
      error: msg,
      isPlatformPlaceholder: false,
      avatarUrl: target.avatarUrl,
    };
  }
}

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

  const fetchTargets = useMemo((): FetchTarget[] => {
    return accountRefs.map((acc) => ({
      platform: acc.platform,
      accountId: acc.accountId,
      avatarUrl: acc.avatarUrl,
    }));
  }, [accountRefs]);

  const actualsQuery = useQuery({
    queryKey: socialMediaInsightQueryKeys.periodActuals(
      organizationId,
      period,
      clampedRange.start,
      clampedRange.end,
    ),
    queryFn: async () => {
      const byAccount: Record<string, PlatformPeriodActuals> = {};
      if (!organizationId || periodNotStarted || fetchTargets.length === 0) {
        return byAccount;
      }

      const accountRows = await mapWithConcurrency(fetchTargets, CONCURRENCY, (target) =>
        fetchAccountMetrics(
          organizationId,
          target,
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
