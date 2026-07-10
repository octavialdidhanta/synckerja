import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { endOfDay } from "date-fns";
import { SocialMediaPerformanceModuleShell } from "@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useYouTubeContentReportingEnabled } from "@/youtube-content/hooks/useYouTubeContentReportingEnabled";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import {
  fetchYouTubeContentVideos,
  useYouTubeContentVideosQuery,
} from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import { YouTubeContentSettingsPanel } from "@/youtube-content/settings/YouTubeContentSettingsPanel";
import {
  YOUTUBE_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/youtube-content/settings/youtubeContentSettingsPaths";
import { YouTubeContentPerformancePageSkeleton } from "@/6-0-social-media-performance/skeletons/YouTubeContentPerformancePageSkeleton";
import { YouTubeContentAccountNav } from "@/6-0-social-media-performance/components/YouTubeContentAccountNav";
import { YouTubeContentSummaryBar } from "@/6-0-social-media-performance/components/YouTubeContentSummaryBar";
import { useYouTubeContentTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useYouTubeContentTargetProgress";
import { YouTubeContentVideosTable } from "@/6-0-social-media-performance/components/YouTubeContentVideosTable";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import {
  fetchYouTubeChannelAnalytics,
  useYouTubeChannelAnalyticsQuery,
} from "@/youtube-content/hooks/useYouTubeChannelAnalyticsQuery";
import { YouTubePerformancePanelTabs } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubePerformancePanelTabs";
import { YouTubeChannelAnalyticsPanel } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubeChannelAnalyticsPanel";
import {
  parseYouTubePerformancePanel,
  YOUTUBE_PERFORMANCE_PANEL_PARAM,
  type YouTubePerformancePanel,
} from "@/6-0-social-media-performance/constants/youtubePerformancePanel";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { resolveYouTubeChannelAnalyticsDateRange } from "@/youtube-content/lib/youtubeAnalyticsDateRange";

const SOCIAL_MEDIA_PERFORMANCE_PATH = "/digital-marketing/social-media-performance";

export default function YouTubeContentPerformancePage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <YouTubeContentPerformancePageSkeleton />;
  return (
    <SocialMediaPerformanceModuleShell>
      <YouTubeContentPerformancePageContent />
    </SocialMediaPerformanceModuleShell>
  );
}

function YouTubeContentPerformancePageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const panel = useMemo(
    () => parseYouTubePerformancePanel(searchParams.get(YOUTUBE_PERFORMANCE_PANEL_PARAM)),
    [searchParams],
  );
  const isSettingsView = location.pathname === YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useYouTubeContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useYouTubeContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();
  const [channelId, setChannelId] = useState("");

  useEffect(() => {
    if (dateSelection.preset !== "all_time") return;
    const { start, end } = tiktokAdsAllTimeDateRange();
    const from = parseYmdLocal(start);
    const to = parseYmdLocal(end);
    if (!from || !to) return;
    const nextTo = endOfDay(to);
    const curFrom = dateSelection.range.from ? toYmdLocal(dateSelection.range.from) : "";
    const curTo = dateSelection.range.to ? toYmdLocal(dateSelection.range.to) : "";
    if (curFrom === start && curTo === toYmdLocal(nextTo)) return;
    setDateSelection((prev) => ({
      ...prev,
      preset: "all_time",
      range: { from, to: nextTo },
    }));
  }, [dateSelection.preset, dateSelection.range.from, dateSelection.range.to, setDateSelection]);

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);

  const dateRange = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;
  const analyticsDateRange = useMemo(
    () => resolveYouTubeChannelAnalyticsDateRange(dateSelection.preset, dateRange),
    [dateSelection.preset, dateRange],
  );
  const analyticsDateStart = analyticsDateRange.start;
  const analyticsDateEnd = analyticsDateRange.end;
  /** All-time loads the full uploads playlist; other presets filter by video publish date (like TikTok). */
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

  const metricsEnabled =
    reportingEnabled &&
    Boolean(channelId) &&
    activeAccounts.some((a) => a.channel_id === channelId) &&
    !isSettingsView &&
    canManage;

  const videosQuery = useYouTubeContentVideosQuery({
    organizationId,
    channelId,
    dateStart,
    dateEnd,
    allVideos: isAllTimeVideosRange,
    filterByPublishDate: false,
    enabled: metricsEnabled && panel === "videos",
  });

  const analyticsQuery = useYouTubeChannelAnalyticsQuery({
    organizationId,
    channelId,
    dateStart: analyticsDateStart,
    dateEnd: analyticsDateEnd,
    enabled: metricsEnabled && panel === "channel-analytics",
  });

  const handlePanelChange = useCallback(
    (next: YouTubePerformancePanel) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "videos") {
            params.delete(YOUTUBE_PERFORMANCE_PANEL_PARAM);
          } else {
            params.set(YOUTUBE_PERFORMANCE_PANEL_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !channelId) return;
    try {
      if (panel === "channel-analytics") {
        const fresh = await fetchYouTubeChannelAnalytics({
          organizationId,
          channelId,
          dateStart: analyticsDateStart,
          dateEnd: analyticsDateEnd,
          forceRefresh: true,
        });
        queryClient.setQueryData(
          ["youtube-channel-analytics", organizationId, channelId, analyticsDateStart, analyticsDateEnd],
          fresh,
        );
        return;
      }
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
      if (panel === "channel-analytics") {
        await analyticsQuery.refetch();
      } else {
        await videosQuery.refetch();
      }
    }
  }, [
    organizationId,
    channelId,
    dateStart,
    dateEnd,
    analyticsDateStart,
    analyticsDateEnd,
    isAllTimeVideosRange,
    queryClient,
    panel,
    analyticsQuery,
    videosQuery,
  ]);

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
    enabled: metricsEnabled && panel === "videos",
  });

  const metricsLoading =
    panel === "channel-analytics"
      ? analyticsQuery.isLoading || (analyticsQuery.isFetching && !analyticsQuery.data)
      : videosQuery.isLoading || (videosQuery.isFetching && !videosQuery.data);

  const isRefreshing =
    panel === "channel-analytics" ? analyticsQuery.isFetching : videosQuery.isFetching;

  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return null;
  }

  return (
    <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  {!canManage ? (
                    <div className="p-6">
                      <Alert>
                        <AlertTitle>
                          {t(
                            "digitalMarketing.youtubeContent.accessDeniedTitle",
                            "Access restricted",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.youtubeContent.accessDeniedBody",
                            "Only the organization owner or an omnichannel admin can view YouTube content insights.",
                          )}{" "}
                          <Link
                            to={YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.youtubeContent.settingsLink", "YouTube settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                      <YouTubeContentAccountNav
                        accounts={activeAccounts}
                        channelId={channelId}
                        onChannelIdChange={(next) => {
                          setChannelId(next);
                          if (isSettingsView) {
                            navigate(YOUTUBE_CONTENT_DIGITAL_MARKETING_BASE_PATH);
                          }
                        }}
                        settingsActive={isSettingsView}
                        onSettingsSelect={() =>
                          navigate(YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH)
                        }
                      />

                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        {isSettingsView ? (
                          <YouTubeContentSettingsPanel
                            organizationId={organizationId}
                            oauthReturnPath={YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                          />
                        ) : (
                          <>
                            <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                              {settings?.serverConfigured === false ? (
                                <Alert variant="destructive">
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.youtubeContent.serverNotConfigured",
                                      "Server not configured",
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      "digitalMarketing.youtubeContent.serverNotConfiguredDesc",
                                      "Set YOUTUBE_CONTENT_CLIENT_ID and YOUTUBE_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
                                    )}
                                  </AlertDescription>
                                </Alert>
                              ) : !reportingPending && !reportingEnabled ? (
                                <Alert>
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.youtubeContent.notConnected",
                                      "YouTube not connected",
                                    )}
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
                                      {t("digitalMarketing.youtubeContent.openSettings", "Open settings")}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : null}

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <YouTubePerformancePanelTabs
                                  panel={panel}
                                  onPanelChange={handlePanelChange}
                                />
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    aria-label={t("digitalMarketing.youtubeContent.refresh", "Refresh")}
                                    disabled={!reportingEnabled || !channelId || isRefreshing}
                                    onClick={() => void handleRefresh()}
                                  >
                                    {isRefreshing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <TikTokAdsDateRangePicker
                                    value={dateSelection}
                                    onChange={setDateSelection}
                                    calendarYearPresetYears={calendarYearPresetYears}
                                  />
                                </div>
                              </div>
                            </div>

                            {panel === "videos" ? (
                              <>
                                <YouTubeContentSummaryBar
                                  summary={videosQuery.data?.summary}
                                  targetProgress={progressList}
                                  isLoading={metricsLoading}
                                  targetsLoading={targetsLoading}
                                  viewsAreLifetime={isAllTimeVideosRange}
                                />

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                  {videosQuery.isError ? (
                                    <div className="p-4">
                                      <Alert variant="destructive">
                                        <AlertTitle>
                                          {t("digitalMarketing.youtubeContent.error", "Failed to load videos")}
                                        </AlertTitle>
                                        <AlertDescription>
                                          {(videosQuery.error as Error)?.message ??
                                            t(
                                              "digitalMarketing.youtubeContent.errorGeneric",
                                              "An error occurred while loading YouTube videos.",
                                            )}
                                        </AlertDescription>
                                      </Alert>
                                    </div>
                                  ) : (
                                    <YouTubeContentVideosTable rows={videosQuery.data?.rows ?? []} />
                                  )}
                                </div>
                              </>
                            ) : (
                              <YouTubeChannelAnalyticsPanel
                                data={analyticsQuery.data ?? undefined}
                                isLoading={metricsLoading}
                                isError={analyticsQuery.isError}
                                error={(analyticsQuery.error as Error) ?? null}
                                isAllTimeRange={dateSelection.preset === "all_time"}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
    </div>
  );
}
