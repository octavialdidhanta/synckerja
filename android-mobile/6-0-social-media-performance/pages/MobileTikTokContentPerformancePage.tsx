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
import { formatSmpCount, formatSmpPercent } from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import {
  formatSmpPostedAt,
  smpTikTokContentPerformanceColumns,
} from "@/mobile/6-0-social-media-performance/shared/smpPerformanceTableColumns";
import { useSmpAllTimeDateClamp } from "@/mobile/6-0-social-media-performance/shared/useSmpAllTimeDateClamp";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useTikTokContentReportingEnabled } from "@/tiktok-content/hooks/useTikTokContentReportingEnabled";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import {
  fetchTikTokContentVideos,
  useTikTokContentVideosQuery,
} from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import { getTikTokAccountDisplayLabel } from "@/tiktok-content/lib/tiktokAccountDisplayLabel";
import { useTikTokContentTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useTikTokContentTargetProgress";
import {
  tiktokContentPeriodCompareBits,
  useTikTokContentSummaryPeriodCompare,
  type TikTokContentCompareCardKey,
} from "@/6-0-social-media-performance/hooks/useTikTokContentSummaryPeriodCompare";
import { TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH } from "@/tiktok-content/settings/tiktokContentSettingsPaths";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";

export default function MobileTikTokContentPerformancePage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokContentSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const [openIdOverride, setOpenIdOverride] = useState<string | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  useSmpAllTimeDateClamp(dateSelection, setDateSelection);

  const dateRange = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;
  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );
  const defaultOpenId =
    (activeAccounts.find((a) => a.is_default) ?? activeAccounts[0])?.open_id ?? "";
  const openId =
    openIdOverride && activeAccounts.some((a) => a.open_id === openIdOverride)
      ? openIdOverride
      : defaultOpenId;

  const videosQuery = useTikTokContentVideosQuery({
    organizationId,
    openId,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(openId) &&
      activeAccounts.some((a) => a.open_id === openId) &&
      canManage,
  });

  const selectedAccountLabel = useMemo(() => {
    const fromQuery = videosQuery.data?.account_label?.trim();
    if (fromQuery) return fromQuery;
    const account = activeAccounts.find((a) => a.open_id === openId);
    return account ? getTikTokAccountDisplayLabel(account) : null;
  }, [videosQuery.data?.account_label, activeAccounts, openId]);

  const { progressList, targetsLoading } = useTikTokContentTargetProgress({
    openId,
    summary: videosQuery.data?.summary,
    accountLabel: selectedAccountLabel,
    enabled: reportingEnabled && Boolean(openId) && canManage,
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !openId) return;
    await runRefresh(async () => {
      try {
        const fresh = await fetchTikTokContentVideos({
          organizationId,
          openId,
          dateStart,
          dateEnd,
          forceRefresh: true,
        });
        queryClient.setQueryData(
          ["tiktok-content-videos", organizationId, openId, dateStart, dateEnd],
          fresh,
        );
      } catch (e) {
        toast.error((e as Error).message);
        await videosQuery.refetch();
      }
    });
  }, [organizationId, openId, dateStart, dateEnd, queryClient, videosQuery, runRefresh]);

  const summary = videosQuery.data?.summary;
  const metricsLoading = videosQuery.isLoading || (videosQuery.isFetching && !videosQuery.data);

  const { previousRange, previousSummary, compareLoading, compareError } =
    useTikTokContentSummaryPeriodCompare({
      organizationId,
      openId,
      dateStart,
      dateEnd,
      enabled: reportingEnabled && Boolean(openId) && canManage,
    });

  const compareFor = (cardKey: TikTokContentCompareCardKey) =>
    tiktokContentPeriodCompareBits({
      cardKey,
      currentSummary: summary,
      previousSummary,
      previousRange,
      compareLoading: compareLoading || metricsLoading,
      compareError,
    });

  const cards = [
    {
      key: "audience",
      metric: "audience" as const,
      label: t("digitalMarketing.tiktokContent.summaryFollowers", "Followers"),
      value: formatSmpCount(summary?.follower_count),
      audienceHint: true,
    },
    {
      key: "videos",
      label: t("digitalMarketing.tiktokContent.summaryVideos", "Videos"),
      value: formatSmpCount(summary?.video_count ?? 0),
      ...compareFor("videos"),
    },
    {
      key: "views",
      metric: "views" as const,
      label: t("digitalMarketing.tiktokContent.summaryViews", "Views"),
      value: formatSmpCount(summary?.total_views ?? 0),
      ...compareFor("views"),
    },
    {
      key: "likes",
      metric: "likes" as const,
      label: t("digitalMarketing.tiktokContent.summaryLikes", "Likes"),
      value: formatSmpCount(summary?.total_likes ?? 0),
      ...compareFor("likes"),
    },
    {
      key: "comments",
      metric: "comments" as const,
      label: t("digitalMarketing.tiktokContent.summaryComments", "Comments"),
      value: formatSmpCount(summary?.total_comments ?? 0),
      ...compareFor("comments"),
    },
    {
      key: "engagement",
      metric: "avg_engagement_rate" as const,
      label: t("digitalMarketing.tiktokContent.summaryEngagement", "Avg. engagement"),
      value: formatSmpPercent(summary?.avg_engagement_rate ?? null),
      ...compareFor("engagement"),
    },
  ];

  const tableColumns = smpTikTokContentPerformanceColumns(t);
  const tableRows = (videosQuery.data?.rows ?? []).map((row) => ({
    id: row.video_id,
    cells: {
      name: (
        <MobileSmpMediaThumb
          src={row.cover_image_url}
          title={row.title || row.video_id}
        />
      ),
      link: row.share_url?.trim() || "—",
      service: row.service_name?.trim() || "—",
      pillar: row.content_pillar?.trim() || "—",
      views: formatSmpCount(row.view_count),
      likes: formatSmpCount(row.like_count),
      comments: formatSmpCount(row.comment_count),
      shares: formatSmpCount(row.share_count),
      engagement: formatSmpPercent(row.engagement_rate),
      posted: formatSmpPostedAt(row.posted_at),
    },
  }));

  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={() => void handleRefresh()}
      refreshDisabled={!reportingEnabled || !openId || manualRefreshing}
      isRefreshing={manualRefreshing}
      headerActions={
        canManage ? (
          <MobileManageCommentsAccountButton
            accounts={activeAccounts.map((a) => ({
              value: a.open_id,
              label: getTikTokAccountDisplayLabel(a),
            }))}
            accountId={openId}
            onAccountIdChange={setOpenIdOverride}
            accountsLoading={settingsPending}
          />
        ) : undefined
      }
    >
      {!canManage && !gatePending ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.accessDeniedBody",
              "Only the organization owner or an omnichannel admin can view TikTok content insights.",
            )}
          </AlertDescription>
        </Alert>
      ) : !reportingPending && !reportingEnabled ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.notConnected", "TikTok not connected")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.notConnectedDesc",
              "Connect a TikTok creator account in settings to view video insights.",
            )}{" "}
            <Link
              to={TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
              className="font-medium text-primary underline"
            >
              {t("digitalMarketing.tiktokContent.openSettings", "Open settings")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <MobileSmpFilterStrip
            accounts={activeAccounts.map((a) => ({
              value: a.open_id,
              label: getTikTokAccountDisplayLabel(a),
            }))}
            accountId={openId}
            onAccountIdChange={setOpenIdOverride}
            accountsLoading={settingsPending}
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
          {videosQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.tiktokContent.error", "Failed to load videos")}
              </AlertTitle>
              <AlertDescription>{(videosQuery.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={metricsLoading}
              itemLabel={t("digitalMarketing.tiktokContent.summaryVideos", "videos")}
              totalCount={summary?.video_count ?? tableRows.length}
              emptyText={t(
                "digitalMarketing.tiktokContent.noVideos",
                "No videos in this date range.",
              )}
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
