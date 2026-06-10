import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { endOfDay } from "date-fns";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useTikTokContentReportingEnabled } from "@/tiktok-content/hooks/useTikTokContentReportingEnabled";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import {
  fetchTikTokContentVideos,
  useTikTokContentVideosQuery,
} from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import { TikTokContentSettingsPanel } from "@/tiktok-content/settings/TikTokContentSettingsPanel";
import {
  TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/tiktok-content/settings/tiktokContentSettingsPaths";
import { TikTokContentPerformancePageSkeleton } from "@/6-0-social-media-performance/skeletons/TikTokContentPerformancePageSkeleton";
import { TikTokContentAccountNav } from "@/6-0-social-media-performance/components/TikTokContentAccountNav";
import { TikTokContentSummaryBar } from "@/6-0-social-media-performance/components/TikTokContentSummaryBar";
import { TikTokContentVideosTable } from "@/6-0-social-media-performance/components/TikTokContentVideosTable";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

const SOCIAL_MEDIA_PERFORMANCE_PATH = "/digital-marketing/social-media-performance";

export default function TikTokContentPerformancePage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokContentPerformancePageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <TikTokContentPerformancePageContent />
    </ModuleShellContentGate>
  );
}

function TikTokContentPerformancePageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();
  const [openId, setOpenId] = useState("");

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

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  useEffect(() => {
    if (!openId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setOpenId(def.open_id);
    }
  }, [activeAccounts, openId]);

  const videosQuery = useTikTokContentVideosQuery({
    organizationId,
    openId,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(openId) &&
      activeAccounts.some((a) => a.open_id === openId) &&
      !isSettingsView &&
      canManage,
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !openId) return;
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
  }, [organizationId, openId, dateStart, dateEnd, queryClient, videosQuery]);

  const metricsLoading =
    videosQuery.isLoading || (videosQuery.isFetching && !videosQuery.data);

  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return <TikTokContentPerformancePageSkeleton />;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  {!canManage ? (
                    <div className="p-6">
                      <Alert>
                        <AlertTitle>
                          {t(
                            "digitalMarketing.tiktokContent.accessDeniedTitle",
                            "Access restricted",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.tiktokContent.accessDeniedBody",
                            "Only the organization owner or an omnichannel admin can view TikTok content insights.",
                          )}{" "}
                          <Link
                            to={TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.tiktokContent.settingsLink", "TikTok settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                      <TikTokContentAccountNav
                        accounts={activeAccounts}
                        openId={openId}
                        onOpenIdChange={(next) => {
                          setOpenId(next);
                          if (isSettingsView) {
                            navigate(TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH);
                          }
                        }}
                        settingsActive={isSettingsView}
                        onSettingsSelect={() =>
                          navigate(TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH)
                        }
                      />

                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        {isSettingsView ? (
                          <TikTokContentSettingsPanel
                            organizationId={organizationId}
                            oauthReturnPath={TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                          />
                        ) : (
                          <>
                            <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                              {settings?.serverConfigured === false ? (
                                <Alert variant="destructive">
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.tiktokContent.serverNotConfigured",
                                      "Server not configured",
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      "digitalMarketing.tiktokContent.serverNotConfiguredDesc",
                                      "Set TIKTOK_CONTENT_CLIENT_KEY and TIKTOK_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
                                    )}
                                  </AlertDescription>
                                </Alert>
                              ) : !reportingPending && !reportingEnabled ? (
                                <Alert>
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.tiktokContent.notConnected",
                                      "TikTok not connected",
                                    )}
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
                              ) : null}

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label={t("digitalMarketing.tiktokContent.refresh", "Refresh")}
                                  disabled={!reportingEnabled || !openId || videosQuery.isFetching}
                                  onClick={() => void handleRefresh()}
                                >
                                  {videosQuery.isFetching ? (
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

                            <TikTokContentSummaryBar
                              summary={videosQuery.data?.summary}
                              isLoading={metricsLoading}
                            />

                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                              {videosQuery.isError ? (
                                <div className="p-4">
                                  <Alert variant="destructive">
                                    <AlertTitle>
                                      {t("digitalMarketing.tiktokContent.error", "Failed to load videos")}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {(videosQuery.error as Error)?.message ??
                                        t(
                                          "digitalMarketing.tiktokContent.errorGeneric",
                                          "An error occurred while loading TikTok videos.",
                                        )}
                                    </AlertDescription>
                                  </Alert>
                                </div>
                              ) : (
                                <TikTokContentVideosTable rows={videosQuery.data?.rows ?? []} />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
