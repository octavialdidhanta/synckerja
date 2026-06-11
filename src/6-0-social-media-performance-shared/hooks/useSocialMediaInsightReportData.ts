import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  buildPlatformPlaceholderRow,
  normalizeLinkedInMetrics,
  normalizeTikTokMetrics,
  normalizeYouTubeMetrics,
} from "@/6-0-social-media-performance-shared/socialMediaInsightNormalize";
import {
  buildMonthlyContentChartPoints,
  buildMonthlyEngagementChartPoints,
  buildMonthlyViewsByPlatformTotals,
  buildMonthlyViewsChartPoints,
  computeInsightSummary,
} from "@/6-0-social-media-performance-shared/socialMediaInsightMonthlyTrend";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightContentRow,
  SocialMediaInsightMonthlyChartPoint,
  SocialMediaInsightSummary,
  SocialMediaPlatformFilter,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { fetchLinkedInContentPosts } from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import { useLinkedInContentSettings } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import { fetchTikTokContentVideos } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import { fetchYouTubeContentVideos } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

const CONCURRENCY = 4;

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

type FetchTarget =
  | { platform: "tiktok"; accountId: string; avatarUrl: string | null }
  | { platform: "youtube"; accountId: string; avatarUrl: string | null }
  | { platform: "linkedin"; accountId: string; avatarUrl: string | null };

async function fetchAccountMetrics(
  organizationId: string,
  target: FetchTarget,
  dateStart: string,
  dateEnd: string,
  forceRefresh: boolean,
): Promise<{ account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] }> {
  try {
    if (target.platform === "tiktok") {
      const payload = await fetchTikTokContentVideos({
        organizationId,
        openId: target.accountId,
        dateStart,
        dateEnd,
        forceRefresh,
      });
      return normalizeTikTokMetrics(payload, target.avatarUrl);
    }
    if (target.platform === "youtube") {
      const payload = await fetchYouTubeContentVideos({
        organizationId,
        channelId: target.accountId,
        dateStart,
        dateEnd,
        forceRefresh,
      });
      return normalizeYouTubeMetrics(payload, target.avatarUrl);
    }
    const payload = await fetchLinkedInContentPosts({
      organizationId,
      pageId: target.accountId,
      dateStart,
      dateEnd,
      forceRefresh,
    });
    return normalizeLinkedInMetrics(payload, target.avatarUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const placeholder = buildPlatformPlaceholderRow(target.platform);
    return {
      account: {
        ...placeholder,
        accountId: target.accountId,
        connected: true,
        loading: false,
        error: msg,
        isPlatformPlaceholder: false,
        avatarUrl: target.avatarUrl,
      },
      contentRows: [],
    };
  }
}

export function useSocialMediaInsightReportData(args: {
  enabled?: boolean;
  platformFilter?: SocialMediaPlatformFilter;
  chartsEnabled?: boolean;
  locale?: string;
}) {
  const {
    enabled = true,
    platformFilter = "all",
    chartsEnabled = true,
    locale = "en-US",
  } = args;
  const forceRefreshRef = useRef(false);
  const { organizationId } = useCurrentOrg();
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();

  const datePayload = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );

  const tiktokSettings = useTikTokContentSettings(organizationId, { enabled });
  const youtubeSettings = useYouTubeContentSettings(organizationId, { enabled });
  const linkedinSettings = useLinkedInContentSettings(organizationId, { enabled });

  const settingsLoading =
    tiktokSettings.isPending || youtubeSettings.isPending || linkedinSettings.isPending;

  const fetchTargets = useMemo((): FetchTarget[] => {
    const targets: FetchTarget[] = [];
    const tt = tiktokSettings.data;
    const yt = youtubeSettings.data;
    const li = linkedinSettings.data;

    if (tt?.oauthConnected && tt.accounts.length > 0) {
      for (const acc of tt.accounts.filter((a) => a.is_active)) {
        targets.push({
          platform: "tiktok",
          accountId: acc.open_id,
          avatarUrl: acc.avatar_url,
        });
      }
    }
    if (yt?.oauthConnected && yt.accounts.length > 0) {
      for (const acc of yt.accounts.filter((a) => a.is_active)) {
        targets.push({
          platform: "youtube",
          accountId: acc.channel_id,
          avatarUrl: acc.thumbnail_url,
        });
      }
    }
    if (li?.oauthConnected && li.accounts.length > 0) {
      for (const acc of li.accounts.filter((a) => a.is_active)) {
        targets.push({
          platform: "linkedin",
          accountId: acc.page_id,
          avatarUrl: acc.thumbnail_url,
        });
      }
    }
    return targets;
  }, [tiktokSettings.data, youtubeSettings.data, linkedinSettings.data]);

  const metricsQuery = useQuery({
    queryKey: socialMediaInsightQueryKeys.report(
      organizationId,
      datePayload.start,
      datePayload.end,
    ),
    queryFn: async () => {
      if (!organizationId) {
        return { accounts: [] as SocialMediaInsightAccountRow[], contentRows: [] as SocialMediaInsightContentRow[] };
      }

      const forceRefresh = forceRefreshRef.current;
      forceRefreshRef.current = false;

      const fetched = await mapWithConcurrency(fetchTargets, CONCURRENCY, (target) =>
        fetchAccountMetrics(
          organizationId,
          target,
          datePayload.start,
          datePayload.end,
          forceRefresh,
        ),
      );

      const accounts: SocialMediaInsightAccountRow[] = [];
      const contentRows: SocialMediaInsightContentRow[] = [];

      for (const item of fetched) {
        accounts.push(item.account);
        contentRows.push(...item.contentRows);
      }

      if (!tiktokSettings.data?.oauthConnected) {
        accounts.push(buildPlatformPlaceholderRow("tiktok"));
      }
      if (!youtubeSettings.data?.oauthConnected) {
        accounts.push(buildPlatformPlaceholderRow("youtube"));
      }
      if (!linkedinSettings.data?.oauthConnected) {
        accounts.push(buildPlatformPlaceholderRow("linkedin"));
      }

      const platformOrder = { tiktok: 0, youtube: 1, linkedin: 2 };
      accounts.sort((a, b) => {
        const po = platformOrder[a.platform] - platformOrder[b.platform];
        if (po !== 0) return po;
        if (a.isPlatformPlaceholder && !b.isPlatformPlaceholder) return -1;
        if (!a.isPlatformPlaceholder && b.isPlatformPlaceholder) return 1;
        return a.accountLabel.localeCompare(b.accountLabel);
      });

      return { accounts, contentRows };
    },
    enabled: Boolean(organizationId) && enabled && !settingsLoading,
    staleTime: 15 * 60_000,
  });

  const filteredAccounts = useMemo(() => {
    const rows = metricsQuery.data?.accounts ?? [];
    if (platformFilter === "all") return rows;
    return rows.filter((r) => r.platform === platformFilter);
  }, [metricsQuery.data?.accounts, platformFilter]);

  const filteredContentRows = useMemo(() => {
    const rows = metricsQuery.data?.contentRows ?? [];
    if (platformFilter === "all") return rows;
    return rows.filter((r) => r.platform === platformFilter);
  }, [metricsQuery.data?.contentRows, platformFilter]);

  const summary: SocialMediaInsightSummary = useMemo(
    () => computeInsightSummary(filteredAccounts),
    [filteredAccounts],
  );

  const monthlyViews: SocialMediaInsightMonthlyChartPoint[] = useMemo(() => {
    if (!chartsEnabled) return [];
    return buildMonthlyViewsChartPoints(
      filteredContentRows,
      datePayload.start,
      datePayload.end,
      locale,
    );
  }, [chartsEnabled, filteredContentRows, datePayload.start, datePayload.end, locale]);

  const monthlyContent: SocialMediaInsightMonthlyChartPoint[] = useMemo(() => {
    if (!chartsEnabled) return [];
    return buildMonthlyContentChartPoints(
      filteredContentRows,
      datePayload.start,
      datePayload.end,
      locale,
    );
  }, [chartsEnabled, filteredContentRows, datePayload.start, datePayload.end, locale]);

  const monthlyEngagement: SocialMediaInsightMonthlyChartPoint[] = useMemo(() => {
    if (!chartsEnabled) return [];
    return buildMonthlyEngagementChartPoints(
      filteredContentRows,
      datePayload.start,
      datePayload.end,
      locale,
    );
  }, [chartsEnabled, filteredContentRows, datePayload.start, datePayload.end, locale]);

  const viewsByPlatform = useMemo(() => {
    if (!chartsEnabled) return [];
    return buildMonthlyViewsByPlatformTotals(filteredContentRows);
  }, [chartsEnabled, filteredContentRows]);

  const pageLoading = settingsLoading || metricsQuery.isLoading;

  const triggerForceRefresh = useCallback(() => {
    forceRefreshRef.current = true;
  }, []);

  return {
    organizationId,
    dateStart: datePayload.start,
    dateEnd: datePayload.end,
    settingsLoading,
    pageLoading,
    isFetching: metricsQuery.isFetching,
    error: metricsQuery.error,
    accounts: filteredAccounts,
    contentRows: filteredContentRows,
    summary,
    monthlyViews,
    monthlyContent,
    monthlyEngagement,
    viewsByPlatform,
    tiktokConnected: Boolean(tiktokSettings.data?.oauthConnected),
    youtubeConnected: Boolean(youtubeSettings.data?.oauthConnected),
    linkedinConnected: Boolean(linkedinSettings.data?.oauthConnected),
    refetch: metricsQuery.refetch,
    triggerForceRefresh,
  };
}
