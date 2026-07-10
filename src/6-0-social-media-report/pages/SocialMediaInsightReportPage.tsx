import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { endOfDay } from "date-fns";
import { toast } from "sonner";
import { SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { SocialMediaPerformanceModuleShell } from "@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell";
import { SocialMediaInsightReportDataProvider } from "@/6-0-social-media-performance-shared/SocialMediaInsightReportDataContext";
import { useSocialMediaInsightReportDataContext } from "@/6-0-social-media-performance-shared/SocialMediaInsightReportDataContext";
import type { SocialMediaPlatformFilter } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { SocialMediaInsightReportAccountTable } from "@/6-0-social-media-report/components/SocialMediaInsightReportAccountTable";
import { SocialMediaInsightReportMonthlyChartsSection } from "@/6-0-social-media-report/components/SocialMediaInsightReportMonthlyChartsSection";
import { SocialMediaInsightReportSummaryBar } from "@/6-0-social-media-report/components/SocialMediaInsightReportSummaryBar";
import { SOCIAL_MEDIA_INSIGHT_TARGETS_PATH } from "@/6-0-social-media-performance-shared/socialMediaInsightPaths";
import { useSocialMediaInsightTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetProgress";
import { SocialMediaInsightReportPageSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportPageSkeleton";
import { SocialMediaInsightReportTablePhaseSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportTablePhaseSkeleton";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export default function SocialMediaInsightReportPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <SocialMediaInsightReportPageSkeleton />;
  return (
    <SocialMediaPerformanceModuleShell activeReportPath={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH}>
      <SocialMediaInsightReportPageGate />
    </SocialMediaPerformanceModuleShell>
  );
}

function SocialMediaInsightReportPageGate() {
  const { t } = useTranslation();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  if (gatePending) return null;
  if (!canManage) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Alert className="max-w-lg">
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.accessDeniedBody",
              "Only organization owners or omnichannel admins can view organic social content insights.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <SocialMediaInsightReportPageRoot />;
}

function SocialMediaInsightReportPageRoot() {
  const [platformFilter, setPlatformFilter] = useState<SocialMediaPlatformFilter>("all");
  const [chartsFetchEnabled, setChartsFetchEnabled] = useState(false);

  const handleTablePhaseReady = useCallback(() => setChartsFetchEnabled(true), []);

  useEffect(() => {
    setChartsFetchEnabled(false);
  }, [platformFilter]);

  return (
    <SocialMediaInsightReportDataProvider
      platformFilter={platformFilter}
      chartsEnabled={chartsFetchEnabled}
    >
      <SocialMediaInsightReportPageBody
        platformFilter={platformFilter}
        setPlatformFilter={setPlatformFilter}
        chartsFetchEnabled={chartsFetchEnabled}
        onTablePhaseReady={handleTablePhaseReady}
      />
    </SocialMediaInsightReportDataProvider>
  );
}

type BodyProps = {
  platformFilter: SocialMediaPlatformFilter;
  setPlatformFilter: (v: SocialMediaPlatformFilter) => void;
  chartsFetchEnabled: boolean;
  onTablePhaseReady: () => void;
};

function SocialMediaInsightReportPageBody({
  platformFilter,
  setPlatformFilter,
  chartsFetchEnabled,
  onTablePhaseReady,
}: BodyProps) {
  const { t } = useAppTranslation();
  const {
    dateSelection,
    setDateSelection,
    filtersHydrated,
  } = useDigitalMarketingPaidAdsFilters();
  const {
    organizationId,
    pageLoading,
    isFetching,
    accounts,
    summary,
    error,
    refetch,
    triggerForceRefresh,
  } = useSocialMediaInsightReportDataContext();

  const { progressList, targetsLoading, periodKey } = useSocialMediaInsightTargetProgress({
    summary,
    accounts,
    platformFilter,
  });

  const manageTargetsHref = useMemo(() => {
    if (!periodKey) return SOCIAL_MEDIA_INSIGHT_TARGETS_PATH;
    const params = new URLSearchParams();
    params.set("periodType", periodKey.periodType);
    params.set("year", String(periodKey.year));
    if (periodKey.month != null) params.set("month", String(periodKey.month));
    if (periodKey.quarter != null) params.set("quarter", String(periodKey.quarter));
    return `${SOCIAL_MEDIA_INSIGHT_TARGETS_PATH}?${params.toString()}`;
  }, [periodKey]);

  const [refreshing, setRefreshing] = useState(false);
  const [showTableSkeletonOverlay, setShowTableSkeletonOverlay] = useState(true);
  const revealRafOuterRef = useRef<number | null>(null);
  const revealRafInnerRef = useRef<number | null>(null);
  const hideOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    setShowTableSkeletonOverlay(true);
  }, [platformFilter]);

  useEffect(() => {
    if (pageLoading) {
      if (revealRafOuterRef.current != null) cancelAnimationFrame(revealRafOuterRef.current);
      if (revealRafInnerRef.current != null) cancelAnimationFrame(revealRafInnerRef.current);
      if (hideOverlayTimeoutRef.current != null) clearTimeout(hideOverlayTimeoutRef.current);
      setShowTableSkeletonOverlay(true);
      return;
    }

    hideOverlayTimeoutRef.current = setTimeout(() => {
      hideOverlayTimeoutRef.current = null;
      revealRafOuterRef.current = requestAnimationFrame(() => {
        revealRafInnerRef.current = requestAnimationFrame(() => {
          revealRafOuterRef.current = null;
          revealRafInnerRef.current = null;
          setShowTableSkeletonOverlay(false);
        });
      });
    }, 200);

    return () => {
      if (hideOverlayTimeoutRef.current != null) clearTimeout(hideOverlayTimeoutRef.current);
      if (revealRafOuterRef.current != null) cancelAnimationFrame(revealRafOuterRef.current);
      if (revealRafInnerRef.current != null) cancelAnimationFrame(revealRafInnerRef.current);
    };
  }, [pageLoading]);

  useEffect(() => {
    if (!pageLoading && !showTableSkeletonOverlay) {
      onTablePhaseReady();
    }
  }, [pageLoading, showTableSkeletonOverlay, onTablePhaseReady]);

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);

  const handleRefreshClick = async () => {
    setRefreshing(true);
    triggerForceRefresh();
    try {
      await refetch();
      toast.success(t("digitalMarketing.socialMediaInsightReport.refreshDone", "Report refreshed."));
    } catch {
      toast.error(t("digitalMarketing.socialMediaInsightReport.refreshError", "Failed to refresh report."));
    } finally {
      setRefreshing(false);
    }
  };

  const hasConnectedData = accounts.some((a) => a.connected && !a.isPlatformPlaceholder);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          showTableSkeletonOverlay && "pointer-events-none opacity-0",
        )}
        aria-hidden={showTableSkeletonOverlay}
      >
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h2 className="text-base font-semibold text-gray-900">
                              {t("digitalMarketing.socialMediaInsightReport.title", "Report")}
                            </h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t(
                                "digitalMarketing.socialMediaInsightReport.subtitle",
                                "Cross-account organic insights for TikTok, YouTube, and LinkedIn. The date filter is shared with other Digital Marketing pages.",
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {filtersHydrated ? (
                              <>
                                <Select
                                  value={platformFilter}
                                  onValueChange={(v) =>
                                    setPlatformFilter(v as SocialMediaPlatformFilter)
                                  }
                                >
                                  <SelectTrigger
                                    className="h-9 w-[11rem] border-gray-200 bg-gray-50 text-sm"
                                    aria-label={t(
                                      "digitalMarketing.socialMediaInsightReport.platformFilterLabel",
                                      "Platform",
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-50 bg-white">
                                    <SelectItem value="all">
                                      {t(
                                        "digitalMarketing.socialMediaInsightReport.platformAll",
                                        "All platforms",
                                      )}
                                    </SelectItem>
                                    <SelectItem value="tiktok">
                                      {t(
                                        "digitalMarketing.socialMediaPerformance.platformTikTok",
                                        "TikTok",
                                      )}
                                    </SelectItem>
                                    <SelectItem value="youtube">
                                      {t(
                                        "digitalMarketing.socialMediaPerformance.platformYouTube",
                                        "YouTube",
                                      )}
                                    </SelectItem>
                                    <SelectItem value="linkedin">
                                      {t(
                                        "digitalMarketing.socialMediaPerformance.platformLinkedIn",
                                        "LinkedIn",
                                      )}
                                    </SelectItem>
                                    <SelectItem value="instagram">
                                      {t(
                                        "digitalMarketing.socialMediaPerformance.platformInstagram",
                                        "Instagram",
                                      )}
                                    </SelectItem>
                                    <SelectItem value="facebook">
                                      {t(
                                        "digitalMarketing.socialMediaPerformance.platformFacebook",
                                        "Facebook",
                                      )}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <TikTokAdsDateRangePicker
                                  value={dateSelection}
                                  onChange={setDateSelection}
                                  calendarYearPresetYears={calendarYearPresetYears}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 shrink-0 gap-1.5"
                                  asChild
                                >
                                  <Link to={manageTargetsHref}>
                                    <Target className="h-4 w-4" />
                                    <span className="hidden sm:inline">
                                      {t(
                                        "digitalMarketing.socialMediaInsightReport.manageTargets",
                                        "Manage targets",
                                      )}
                                    </span>
                                  </Link>
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  disabled={refreshing || isFetching}
                                  onClick={handleRefreshClick}
                                  aria-label={t(
                                    "digitalMarketing.socialMediaInsightReport.refresh",
                                    "Refresh",
                                  )}
                                >
                                  {refreshing || isFetching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <div className="flex gap-2" aria-hidden>
                                <div className="h-9 w-[11rem] rounded-md border border-gray-200 bg-gray-50" />
                                <div className="h-9 w-52 rounded-md border border-gray-300 bg-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {error ? (
                        <Alert variant="destructive">
                          <AlertTitle>
                            {t("digitalMarketing.socialMediaInsightReport.error", "Failed to load report")}
                          </AlertTitle>
                          <AlertDescription>
                            {error instanceof Error ? error.message : String(error)}
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <SocialMediaInsightReportSummaryBar
                        summary={summary}
                        targetProgress={progressList}
                        isLoading={showTableSkeletonOverlay}
                        targetsLoading={targetsLoading && !showTableSkeletonOverlay}
                      />

                      <SocialMediaInsightReportAccountTable
                        rows={accounts}
                        organizationId={organizationId}
                        isLoading={showTableSkeletonOverlay}
                      />

                      <SocialMediaInsightReportMonthlyChartsSection
                        bootstrapLoading={showTableSkeletonOverlay}
                        chartPhaseLoading={chartsFetchEnabled && (pageLoading || isFetching)}
                      />

                      {!pageLoading && !hasConnectedData ? (
                        <p className="text-center text-sm text-muted-foreground">
                          {t(
                            "digitalMarketing.socialMediaInsightReport.noConnectedAccounts",
                            "Connect TikTok, YouTube, or LinkedIn accounts in settings to see insights.",
                          )}
                        </p>
                      ) : null}
                    </div>
        </div>

        <div
          className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>

      {showTableSkeletonOverlay ? (
          <div
            className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
            aria-busy
            aria-label={t("digitalMarketing.socialMediaInsightReport.pageLoading", "Loading report")}
          >
            <SocialMediaInsightReportTablePhaseSkeleton />
          </div>
        ) : null}
    </div>
  );
}
