import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { endOfDay } from "date-fns";
import { SocialMediaPerformanceHeaderAndTab } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useLinkedInContentReportingEnabled } from "@/linkedin-content/hooks/useLinkedInContentReportingEnabled";
import { useLinkedInContentSettings } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import {
  fetchLinkedInContentPosts,
  useLinkedInContentPostsQuery,
} from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import { LinkedInContentSettingsPanel } from "@/linkedin-content/settings/LinkedInContentSettingsPanel";
import {
  LINKEDIN_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/linkedin-content/settings/linkedinContentSettingsPaths";
import { LinkedInContentPerformancePageSkeleton } from "@/6-0-social-media-performance/skeletons/LinkedInContentPerformancePageSkeleton";
import { LinkedInContentAccountNav } from "@/6-0-social-media-performance/components/LinkedInContentAccountNav";
import { LinkedInContentSummaryBar } from "@/6-0-social-media-performance/components/LinkedInContentSummaryBar";
import { LinkedInContentPostsTable } from "@/6-0-social-media-performance/components/LinkedInContentPostsTable";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

const SOCIAL_MEDIA_PERFORMANCE_PATH = "/digital-marketing/social-media-performance";

export default function LinkedInContentPerformancePage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <LinkedInContentPerformancePageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <LinkedInContentPerformancePageContent />
    </ModuleShellContentGate>
  );
}

function LinkedInContentPerformancePageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useLinkedInContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useLinkedInContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();
  const [pageId, setPageId] = useState("");

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
    if (!pageId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setPageId(def.page_id);
    }
  }, [activeAccounts, pageId]);

  const postsQuery = useLinkedInContentPostsQuery({
    organizationId,
    pageId,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(pageId) &&
      activeAccounts.some((a) => a.page_id === pageId) &&
      !isSettingsView &&
      canManage,
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !pageId) return;
    try {
      const fresh = await fetchLinkedInContentPosts({
        organizationId,
        pageId,
        dateStart,
        dateEnd,
        forceRefresh: true,
      });
      queryClient.setQueryData(
        ["linkedin-content-posts", organizationId, pageId, dateStart, dateEnd],
        fresh,
      );
    } catch (e) {
      toast.error((e as Error).message);
      await postsQuery.refetch();
    }
  }, [organizationId, pageId, dateStart, dateEnd, queryClient, postsQuery]);

  const metricsLoading =
    postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data);

  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return <LinkedInContentPerformancePageSkeleton />;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-1 min-w-0 shrink-0">
                <SocialMediaPerformanceHeaderAndTab />
              </div>

              <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  {!canManage ? (
                    <div className="p-6">
                      <Alert>
                        <AlertTitle>
                          {t(
                            "digitalMarketing.linkedinContent.accessDeniedTitle",
                            "Access restricted",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.linkedinContent.accessDeniedBody",
                            "Only the organization owner or an omnichannel admin can view LinkedIn content insights.",
                          )}{" "}
                          <Link
                            to={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.linkedinContent.settingsLink", "LinkedIn settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                      <LinkedInContentAccountNav
                        accounts={activeAccounts}
                        pageId={pageId}
                        onPageIdChange={(next) => {
                          setPageId(next);
                          if (isSettingsView) {
                            navigate(LINKEDIN_CONTENT_DIGITAL_MARKETING_BASE_PATH);
                          }
                        }}
                        settingsActive={isSettingsView}
                        onSettingsSelect={() =>
                          navigate(LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH)
                        }
                      />

                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        {isSettingsView ? (
                          <LinkedInContentSettingsPanel
                            organizationId={organizationId}
                            oauthReturnPath={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                          />
                        ) : (
                          <>
                            <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                              {settings?.serverConfigured === false ? (
                                <Alert variant="destructive">
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.linkedinContent.serverNotConfigured",
                                      "Server not configured",
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      "digitalMarketing.linkedinContent.serverNotConfiguredDesc",
                                      "Set LINKEDIN_CONTENT_CLIENT_ID and LINKEDIN_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
                                    )}
                                  </AlertDescription>
                                </Alert>
                              ) : !reportingPending && !reportingEnabled ? (
                                <Alert>
                                  <AlertTitle>
                                    {t(
                                      "digitalMarketing.linkedinContent.notConnected",
                                      "LinkedIn not connected",
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      "digitalMarketing.linkedinContent.notConnectedDesc",
                                      "Connect a LinkedIn page in settings to view post insights.",
                                    )}{" "}
                                    <Link
                                      to={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                                      className="font-medium text-primary underline"
                                    >
                                      {t("digitalMarketing.linkedinContent.openSettings", "Open settings")}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : null}

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label={t("digitalMarketing.linkedinContent.refresh", "Refresh")}
                                  disabled={!reportingEnabled || !pageId || postsQuery.isFetching}
                                  onClick={() => void handleRefresh()}
                                >
                                  {postsQuery.isFetching ? (
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

                            <LinkedInContentSummaryBar
                              summary={postsQuery.data?.summary}
                              isLoading={metricsLoading}
                            />

                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                              {postsQuery.isError ? (
                                <div className="p-4">
                                  <Alert variant="destructive">
                                    <AlertTitle>
                                      {t("digitalMarketing.linkedinContent.error", "Failed to load posts")}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {(postsQuery.error as Error)?.message ??
                                        t(
                                          "digitalMarketing.linkedinContent.errorGeneric",
                                          "An error occurred while loading LinkedIn posts.",
                                        )}
                                    </AlertDescription>
                                  </Alert>
                                </div>
                              ) : (
                                <LinkedInContentPostsTable rows={postsQuery.data?.rows ?? []} />
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
