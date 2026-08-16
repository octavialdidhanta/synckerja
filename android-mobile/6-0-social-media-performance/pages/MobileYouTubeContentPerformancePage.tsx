import { useCallback, useEffect, useMemo, useState } from "react";
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
  smpYouTubeContentPerformanceColumns,
} from "@/mobile/6-0-social-media-performance/shared/smpPerformanceTableColumns";
import { useSmpAllTimeDateClamp } from "@/mobile/6-0-social-media-performance/shared/useSmpAllTimeDateClamp";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useYouTubeContentReportingEnabled } from "@/youtube-content/hooks/useYouTubeContentReportingEnabled";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import {
  fetchYouTubeContentVideos,
  useYouTubeContentVideosQuery,
} from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import { useYouTubeContentTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useYouTubeContentTargetProgress";
import {
  useYouTubeContentSummaryPeriodCompare,
  youtubeContentPeriodCompareBits,
  type YouTubeContentCompareCardKey,
} from "@/6-0-social-media-performance/hooks/useYouTubeContentSummaryPeriodCompare";
import { YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH } from "@/youtube-content/settings/youtubeContentSettingsPaths";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";

export default function MobileYouTubeContentPerformancePage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useYouTubeContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useYouTubeContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const [channelId, setChannelId] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  useSmpAllTimeDateClamp(dateSelection, setDateSelection);

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);
  const dateRange = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;
  const isAllTimeVideosRange = dateSelection.preset === "all_time";

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  useEffect(() => {
    if (!channelId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setChannelId(def.channel_id);
    }
  }, [activeAccounts, channelId]);

  const videosQuery = useYouTubeContentVideosQuery({
    organizationId,
    channelId,
    dateStart,
    dateEnd,
    allVideos: isAllTimeVideosRange,
    filterByPublishDate: false,
    enabled:
      reportingEnabled &&
      Boolean(channelId) &&
      activeAccounts.some((a) => a.channel_id === channelId) &&
      canManage,
  });

  const selectedAccountLabel = useMemo(() => {
    const fromQuery = videosQuery.data?.account_label?.trim();
    if (fromQuery) return fromQuery;
    const account = activeAccounts.find((a) => a.channel_id === channelId);
    return account?.label?.trim() ?? account?.display_name?.trim() ?? null;
  }, [videosQuery.data?.account_label, activeAccounts, channelId]);

  const { progressList, targetsLoading } = useYouTubeContentTargetProgress({
    channelId,
    summary: videosQuery.data?.summary,
    accountLabel: selectedAccountLabel,
    enabled: reportingEnabled && Boolean(channelId) && canManage,
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !channelId) return;
    await runRefresh(async () => {
      try {
        const fresh = await fetchYouTubeContentVideos({
          organizationId,
          channelId,
          dateStart,
          dateEnd,
          allVideos: isAllTimeVideosRange,
          filterByPublishDate: false,
          forceRefresh: true,
        });
        queryClient.setQueryData(
          [
            "youtube-content-videos",
            organizationId,
            channelId,
            dateStart,
            dateEnd,
            isAllTimeVideosRange,
            false,
          ],
          fresh,
        );
      } catch (e) {
        toast.error((e as Error).message);
        await videosQuery.refetch();
      }
    });
  }, [organizationId, channelId, dateStart, dateEnd, isAllTimeVideosRange, queryClient, videosQuery, runRefresh]);

  const summary = videosQuery.data?.summary;
  const metricsLoading = videosQuery.isLoading || (videosQuery.isFetching && !videosQuery.data);

  const { previousRange, previousSummary, compareLoading, compareError } =
    useYouTubeContentSummaryPeriodCompare({
      organizationId,
      channelId,
      dateStart,
      dateEnd,
      enabled: reportingEnabled && Boolean(channelId) && canManage,
    });

  const compareFor = (cardKey: YouTubeContentCompareCardKey) =>
    youtubeContentPeriodCompareBits({
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
      label: t("digitalMarketing.youtubeContent.summarySubscribers", "Subscribers"),
      value: formatSmpCount(summary?.subscriber_count),
      audienceHint: true,
    },
    {
      key: "videos",
      label: t("digitalMarketing.youtubeContent.summaryVideos", "Videos"),
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

  const tableColumns = smpYouTubeContentPerformanceColumns(t);
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
      subscribe: formatSmpCount(row.subscribers_gained ?? 0),
      engagement: formatSmpPercent(row.engagement_rate),
      posted: formatSmpPostedAt(row.posted_at),
    },
  }));

  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={() => void handleRefresh()}
      refreshDisabled={!reportingEnabled || !channelId || manualRefreshing}
      isRefreshing={manualRefreshing}
      headerActions={
        canManage ? (
          <MobileManageCommentsAccountButton
            accounts={activeAccounts.map((a) => ({
              value: a.channel_id,
              label: a.label?.trim() || a.display_name?.trim() || a.channel_id,
            }))}
            accountId={channelId}
            onAccountIdChange={setChannelId}
            accountsLoading={settingsPending}
          />
        ) : undefined
      }
    >
      {!canManage && !gatePending ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.youtubeContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.youtubeContent.accessDeniedBody",
              "Only the organization owner or an omnichannel admin can view YouTube content insights.",
            )}
          </AlertDescription>
        </Alert>
      ) : !reportingPending && !reportingEnabled ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.youtubeContent.notConnected", "YouTube not connected")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.youtubeContent.notConnectedDesc",
              "Connect a YouTube channel in settings to view video insights.",
            )}{" "}
            <Link
              to={YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
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
              value: a.channel_id,
              label: a.label?.trim() || a.display_name?.trim() || a.channel_id,
            }))}
            accountId={channelId}
            onAccountIdChange={setChannelId}
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
                {t("digitalMarketing.youtubeContent.error", "Failed to load videos")}
              </AlertTitle>
              <AlertDescription>{(videosQuery.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={metricsLoading}
              itemLabel={t("digitalMarketing.youtubeContent.summaryVideos", "videos")}
              totalCount={summary?.video_count ?? tableRows.length}
              emptyText={t(
                "digitalMarketing.youtubeContent.noVideos",
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
