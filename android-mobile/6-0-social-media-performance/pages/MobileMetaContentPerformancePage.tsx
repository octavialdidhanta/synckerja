import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { MobileSocialMediaPerformancePageFrame } from "@/mobile/6-0-social-media-performance/components/MobileSocialMediaPerformancePageFrame";
import { MobileSmpFilterStrip } from "@/mobile/6-0-social-media-performance/components/MobileSmpFilterStrip";
import { MobileManageCommentsAccountButton } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsAccountButton";
import { useSmpManualRefresh } from "@/mobile/6-0-social-media-performance/shared/useSmpManualRefresh";
import { MobileSmpSummaryGrid } from "@/mobile/6-0-social-media-performance/components/MobileSmpSummaryGrid";
import { MobileSmpMetricsTable } from "@/mobile/6-0-social-media-performance/components/MobileSmpMetricsTable";
import { MobileSmpMediaThumb } from "@/mobile/6-0-social-media-performance/components/MobileSmpMediaThumb";
import { resolveMetaPostThumbnailUrl } from "@/6-0-social-media-performance/lib/resolveMetaPostThumbnailUrl";
import {
  formatSmpCount,
  formatSmpPercent,
  formatSmpWatchTime,
} from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import {
  formatSmpPostedAt,
  resolveSmpMetaPostLabel,
  smpMetaContentPerformanceColumns,
} from "@/mobile/6-0-social-media-performance/shared/smpPerformanceTableColumns";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useMetaContentTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useMetaContentTargetProgress";
import {
  buildMetaContentCompareSnapshot,
  metaContentPeriodCompareBits,
  useMetaContentSummaryPeriodCompare,
  type MetaContentCompareCardKey,
} from "@/6-0-social-media-performance/hooks/useMetaContentSummaryPeriodCompare";
import { useMetaContentConfig } from "@/meta-content/hooks/useMetaContentConfig";
import {
  fetchMetaContentMetrics,
  useMetaContentMetricsQuery,
} from "@/meta-content/hooks/useMetaContentMetrics";
import { getMetaContentSettingsPath } from "@/meta-content/settings/metaContentSettingsPaths";
import { missingScopesForFeature } from "@/meta-platform/constants/metaOAuthScopes";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";
import { buildMetaContentCalendarYearPresetYears } from "@/meta-content/lib/clampMetaContentDateRange";
import { metaContentMetricsFetchArgs } from "@/meta-content/lib/toMetaContentMetricsDateRangePayload";

type MobileMetaContentPerformancePageProps = {
  platform: MetaContentPlatform;
};

export function MobileMetaContentPerformancePage({ platform }: MobileMetaContentPerformancePageProps) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const configQuery = useMetaContentConfig(organizationId);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const settingsPath = getMetaContentSettingsPath(platform);
  const calendarYearPresetYears = useMemo(() => buildMetaContentCalendarYearPresetYears(), []);
  const metricsFetchArgs = useMemo(
    () => metaContentMetricsFetchArgs(dateSelection),
    [dateSelection],
  );
  const { dateStart, dateEnd, allTime } = metricsFetchArgs;

  const platformAccounts = useMemo(
    () => (configQuery.data?.accounts ?? []).filter((a) => a.platform === platform),
    [configQuery.data?.accounts, platform],
  );
  const defaultAccountId = platformAccounts[0]?.account_id ?? "";
  const accountId =
    accountIdOverride && platformAccounts.some((a) => a.account_id === accountIdOverride)
      ? accountIdOverride
      : defaultAccountId;
  const selectedAccount = platformAccounts.find((a) => a.account_id === accountId) ?? null;
  const insightsScopesGranted = selectedAccount
    ? missingScopesForFeature(selectedAccount.granted_scopes ?? [], "insights").length === 0
    : false;
  const showMetricsView =
    Boolean(accountId) &&
    platformAccounts.some((a) => a.account_id === accountId) &&
    insightsScopesGranted;

  const metricsQuery = useMetaContentMetricsQuery({
    organizationId,
    platform,
    accountId,
    dateStart,
    dateEnd,
    allTime,
    enabled: Boolean(organizationId && accountId && !gatePending && showMetricsView),
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !accountId) return;
    const rangeKeyStart = allTime ? "all_time" : (dateStart ?? "all_time");
    const rangeKeyEnd = allTime ? "all_time" : (dateEnd ?? "all_time");
    const queryKey = [
      "meta-content-metrics",
      "v17",
      organizationId,
      platform,
      accountId,
      rangeKeyStart,
      rangeKeyEnd,
    ] as const;
    await runRefresh(async () => {
      try {
        await queryClient.invalidateQueries({ queryKey });
        const fresh = await fetchMetaContentMetrics({
          organizationId,
          platform,
          accountId,
          dateStart,
          dateEnd,
          allTime,
        });
        queryClient.setQueryData(queryKey, fresh);
      } catch (e) {
        toast.error((e as Error).message);
        await metricsQuery.refetch();
      }
    });
  }, [organizationId, accountId, platform, dateStart, dateEnd, allTime, queryClient, metricsQuery, runRefresh]);

  const { progressList, targetsLoading } = useMetaContentTargetProgress({
    platform,
    accountId,
    account: metricsQuery.data?.account,
    accountLabel: selectedAccount?.account_label ?? null,
    avatarUrl: selectedAccount?.avatar_url ?? null,
    enabled: showMetricsView,
  });

  const account = metricsQuery.data?.account;
  const metricsLoading = metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);
  const showConnectCta = !configQuery.isLoading && platformAccounts.length === 0;
  const platformName = platform === "instagram" ? "Instagram" : "Facebook";

  const { previousRange, previousSnapshot, compareLoading, compareError } =
    useMetaContentSummaryPeriodCompare({
      organizationId,
      platform,
      accountId,
      dateStart,
      dateEnd,
      enabled: showMetricsView,
    });
  const currentSnapshot = buildMetaContentCompareSnapshot(metricsQuery.data);

  const compareFor = (cardKey: MetaContentCompareCardKey) =>
    metaContentPeriodCompareBits({
      cardKey,
      currentSnapshot,
      previousSnapshot,
      previousRange,
      compareLoading: compareLoading || metricsLoading,
      compareError,
    });

  const cards = [
    {
      key: "audience",
      metric: "audience" as const,
      label: t("digitalMarketing.socialMediaInsightReport.colAudience", "Audience"),
      value: formatSmpCount(account?.audience_count),
      audienceHint: true,
    },
    {
      key: "posts",
      label: t("digitalMarketing.metaContent.summaryPosts", "Posts"),
      value: formatSmpCount(account?.content_count ?? 0),
      ...compareFor("posts"),
    },
    {
      key: "views",
      metric: "views" as const,
      label: t("digitalMarketing.tiktokContent.summaryViews", "Views"),
      value: formatSmpCount(account?.total_views ?? 0),
      ...compareFor("views"),
    },
    {
      key: "likes",
      metric: "likes" as const,
      label: t("digitalMarketing.tiktokContent.summaryLikes", "Likes"),
      value: formatSmpCount(account?.total_likes ?? 0),
      ...compareFor("likes"),
    },
    {
      key: "comments",
      metric: "comments" as const,
      label: t("digitalMarketing.tiktokContent.summaryComments", "Comments"),
      value: formatSmpCount(account?.total_comments ?? 0),
      ...compareFor("comments"),
    },
    {
      key: "engagement",
      metric: "avg_engagement_rate" as const,
      label: t("digitalMarketing.tiktokContent.summaryEngagement", "Avg. engagement"),
      value: formatSmpPercent(account?.avg_engagement_rate ?? null),
      ...compareFor("avgEngagement"),
    },
  ];

  const tableColumns = smpMetaContentPerformanceColumns(t);
  const tableRows = (metricsQuery.data?.posts ?? []).map((row) => ({
    id: row.content_id,
    cells: {
      caption: (
        <MobileSmpMediaThumb
          src={resolveMetaPostThumbnailUrl(row)}
          title={resolveSmpMetaPostLabel(row)}
          variant="post"
        />
      ),
      link: row.permalink?.trim() || "—",
      service: row.service_name?.trim() || "—",
      pillar: row.content_pillar?.trim() || "—",
      posted: formatSmpPostedAt(row.posted_at),
      views: formatSmpCount(row.view_count),
      reach: formatSmpCount(row.reach),
      avgWatchTime: formatSmpWatchTime(row.avg_watch_time_ms),
      likes: formatSmpCount(row.like_count),
      comments: formatSmpCount(row.comment_count),
      shares: formatSmpCount(row.share_count),
      saved: formatSmpCount(row.save_count),
      engagement: formatSmpPercent(row.engagement_rate),
    },
  }));

  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={() => void handleRefresh()}
      refreshDisabled={!showMetricsView || manualRefreshing}
      isRefreshing={manualRefreshing}
      headerActions={
        showConnectCta ? undefined : (
          <MobileManageCommentsAccountButton
            accounts={platformAccounts.map((a) => ({
              value: a.account_id,
              label: a.account_label || a.account_id,
            }))}
            accountId={accountId}
            onAccountIdChange={setAccountIdOverride}
            accountsLoading={configQuery.isPending}
          />
        )
      }
    >
      {showConnectCta ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.metaContent.notConnected", `${platformName} not connected`)}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.metaContent.notConnectedDesc",
              `Connect a ${platformName} account in settings to view post insights.`,
            )}{" "}
            <Link to={settingsPath} className="font-medium text-primary underline">
              {t("digitalMarketing.tiktokContent.openSettings", "Open settings")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <MobileSmpFilterStrip
            accounts={platformAccounts.map((a) => ({
              value: a.account_id,
              label: a.account_label || a.account_id,
            }))}
            accountId={accountId}
            onAccountIdChange={setAccountIdOverride}
            accountsLoading={configQuery.isPending}
            showAccount={false}
            dateSelection={dateSelection}
            onDateSelectionChange={setDateSelection}
            filtersHydrated={filtersHydrated}
            calendarYearPresetYears={calendarYearPresetYears}
            onCustomDateClick={() => setShowCustomDatePicker(true)}
          />
          <MobileSmpSummaryGrid
            cards={cards}
            isLoading={metricsLoading}
            targetsLoading={targetsLoading}
            targetProgress={progressList}
          />
          {metricsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.metaContent.error", "Failed to load posts")}
              </AlertTitle>
              <AlertDescription>{(metricsQuery.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={metricsLoading}
              itemLabel={t("digitalMarketing.metaContent.summaryPosts", "posts")}
              emptyText={t("digitalMarketing.metaContent.noPosts", "No posts in this date range.")}
            />
          )}
        </>
      )}

      <CustomDatePicker
        isOpen={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        onDateRangeSelect={(start, end) => {
          setDateSelection((prev) => ({
            ...prev,
            preset: "custom",
            range: { from: start, to: end },
          }));
          setShowCustomDatePicker(false);
        }}
        initialStartDate={dateSelection.range.from ?? undefined}
        initialEndDate={dateSelection.range.to ?? undefined}
      />
    </MobileSocialMediaPerformancePageFrame>
  );
}
