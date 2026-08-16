import { useEffect, useMemo, useRef, useState } from "react";
import { Target } from "lucide-react";
import { Link } from "react-router-dom";
import { computePresetRange, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { DM_REPORT_TARGETS_PATH } from "@/6-0-digital-marketing-shared/dmReportTargetPaths";
import { resolveDmReportTargetPeriod } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  DigitalMarketingReportDataProvider,
  useDigitalMarketingReportData,
} from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import {
  buildReportServiceFilterOptions,
  type ReportServiceFilterValue,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { DigitalMarketingReportSummaryBar } from "@/6-0-report/components/DigitalMarketingReportSummaryBar";
import { DigitalMarketingReportTable } from "@/6-0-report/components/DigitalMarketingReportTable";
import { DigitalMarketingReportMonthlyChartsSection } from "@/6-0-report/components/DigitalMarketingReportMonthlyChartsSection";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { DigitalMarketingReportTablePhaseSkeleton } from "@/6-0-report/skeletons/DigitalMarketingReportTablePhaseSkeleton";
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";

function channelHasNoMetrics(cost: ReportChannelCost): boolean {
  if (!cost.connected) return true;
  return (
    (cost.amount ?? 0) === 0 &&
    (cost.impressions ?? 0) === 0 &&
    (cost.clicks ?? 0) === 0
  );
}

function googleReportHasNoMetrics(
  googleCost: ReportChannelCost,
  googleServiceRows: ReportGoogleServiceRow[],
): boolean {
  if (!googleCost.connected) return true;
  if (googleServiceRows.length === 0) return channelHasNoMetrics(googleCost);
  return googleServiceRows.every(
    (r) => r.amount === 0 && r.impressions === 0 && r.clicks === 0,
  );
}

function metaReportHasNoMetrics(
  metaCost: ReportChannelCost,
  metaServiceRows: ReportMetaServiceRow[],
): boolean {
  if (!metaCost.connected) return true;
  if (metaServiceRows.length === 0) return channelHasNoMetrics(metaCost);
  return metaServiceRows.every(
    (r) => r.amount === 0 && r.impressions === 0 && r.clicks === 0,
  );
}

function tiktokReportHasNoMetrics(
  tiktokCost: ReportChannelCost,
  tiktokServiceRows: ReportTikTokServiceRow[],
): boolean {
  if (!tiktokCost.connected) return true;
  if (tiktokServiceRows.length === 0) return channelHasNoMetrics(tiktokCost);
  return tiktokServiceRows.every(
    (r) => r.amount === 0 && r.impressions === 0 && r.clicks === 0,
  );
}

type ReportPageBodyProps = {
  chartsFetchEnabled: boolean;
  onTablePhaseReady: () => void;
};

function DigitalMarketingReportPageBody({
  chartsFetchEnabled,
  onTablePhaseReady,
}: ReportPageBodyProps) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const {
    dateSelection,
    setDateSelection,
    filtersHydrated,
    reportServiceFilter,
    setReportServiceFilter,
    reportChartCompareEnabled,
    setReportChartCompareEnabled,
  } = useDigitalMarketingPaidAdsFilters();
  const {
    googleCost,
    metaCost,
    tiktokCost,
    googleServiceRows,
    googleServicesLoading,
    metaServiceRows,
    metaServicesLoading,
    tiktokServiceRows,
    tiktokServicesLoading,
    pageLoading,
    effectiveGoogleCustomerId,
    monthlySpend,
  } = useDigitalMarketingReportData();

  const { chartLoading } = monthlySpend;

  const rawTablePhasePending =
    pageLoading || googleCost.loading || metaCost.loading || tiktokCost.loading;

  const [showTableSkeletonOverlay, setShowTableSkeletonOverlay] = useState(true);
  const revealRafOuterRef = useRef<number | null>(null);
  const revealRafInnerRef = useRef<number | null>(null);
  const hideOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShowTableSkeletonOverlay(true);
  }, [organizationId]);

  useEffect(() => {
    if (rawTablePhasePending) {
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
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
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
    };
  }, [rawTablePhasePending]);

  useEffect(() => {
    if (!rawTablePhasePending && !showTableSkeletonOverlay) {
      onTablePhaseReady();
    }
  }, [rawTablePhasePending, showTableSkeletonOverlay, onTablePhaseReady]);

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    effectiveGoogleCustomerId,
    Boolean(organizationId && effectiveGoogleCustomerId),
  );

  /** All time on Report follows Google account bounds (not Meta's 37-month picker range). */
  useEffect(() => {
    const earliest = accountDateBounds?.earliest_date;
    if (!earliest) return;
    setDateSelection((prev) => {
      if (prev.preset !== "all_time") return prev;
      const range = computePresetRange("all_time", new Date(), {
        accountEarliestYmd: earliest,
      });
      const nextFrom = range.from ? toYmdLocal(range.from) : null;
      const nextTo = range.to ? toYmdLocal(range.to) : null;
      const prevFrom = prev.range.from ? toYmdLocal(prev.range.from) : null;
      const prevTo = prev.range.to ? toYmdLocal(prev.range.to) : null;
      if (prevFrom === nextFrom && prevTo === nextTo) return prev;
      return { ...prev, range };
    });
  }, [accountDateBounds?.earliest_date, setDateSelection]);

  const serviceFilterOptions = useMemo(
    () =>
      buildReportServiceFilterOptions(
        [...googleServiceRows, ...metaServiceRows, ...tiktokServiceRows],
        {
          all: t("digitalMarketing.report.serviceFilterAll", "All services"),
          unmapped: t("digitalMarketing.report.serviceUnmapped", "Belum di-map"),
        },
      ),
    [googleServiceRows, metaServiceRows, tiktokServiceRows, t],
  );

  const calendarYearPresetYears = useMemo(
    () => buildReportYearOptionsFromEarliest(accountDateBounds?.earliest_date),
    [accountDateBounds?.earliest_date],
  );

  const resolvedTargetPeriod = useMemo(
    () => resolveDmReportTargetPeriod(dateSelection),
    [dateSelection],
  );

  const manageTargetsHref = useMemo(() => {
    if (!resolvedTargetPeriod) return DM_REPORT_TARGETS_PATH;
    const params = new URLSearchParams();
    params.set("periodType", resolvedTargetPeriod.periodType);
    params.set("year", String(resolvedTargetPeriod.year));
    if (resolvedTargetPeriod.month != null) {
      params.set("month", String(resolvedTargetPeriod.month));
    }
    if (resolvedTargetPeriod.quarter != null) {
      params.set("quarter", String(resolvedTargetPeriod.quarter));
    }
    return `${DM_REPORT_TARGETS_PATH}?${params.toString()}`;
  }, [resolvedTargetPeriod]);

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
                        <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 shrink-0">
                              <h2 className="text-base font-semibold text-gray-900">
                                {t("digitalMarketing.report.title", "Report")}
                              </h2>
                            </div>
                            <div className="nested-scroll-touch-chain-xy min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                              <div className="flex w-max min-w-full items-center justify-end gap-2">
                              {filtersHydrated ? (
                                <>
                                  <Select
                                    value={reportServiceFilter || "all"}
                                    onValueChange={(v) =>
                                      setReportServiceFilter(
                                        v === "all" ? "" : (v as ReportServiceFilterValue),
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className="h-9 w-[14rem] shrink-0 border-gray-200 bg-gray-50 text-sm"
                                      aria-label={t(
                                        "digitalMarketing.report.tableServiceFilterLabel",
                                        "Service",
                                      )}
                                    >
                                      <SelectValue
                                        placeholder={t(
                                          "digitalMarketing.report.serviceFilterAll",
                                          "All services",
                                        )}
                                      />
                                    </SelectTrigger>
                                    <SelectContent className="z-50 max-h-72 bg-white">
                                      {serviceFilterOptions.map((opt) => (
                                        <SelectItem
                                          key={opt.value || "all"}
                                          value={opt.value || "all"}
                                        >
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <GoogleAdsDateRangePicker
                                    value={dateSelection}
                                    onChange={setDateSelection}
                                    accountEarliestYmd={accountDateBounds?.earliest_date}
                                    calendarYearPresetYears={calendarYearPresetYears}
                                    calendarYearFilterHint={t(
                                      "digitalMarketing.report.calendarYearFilterHint",
                                      "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                                    )}
                                    allTimePopoverHint={t(
                                      "digitalMarketing.report.allTimeRangeHint",
                                      "All time: Google cost uses full account history from first activity. Meta cost uses the last 37 months (Meta API limit).",
                                    )}
                                    compareEnabled={reportChartCompareEnabled}
                                    onCompareChange={setReportChartCompareEnabled}
                                    compareHint={t(
                                      "digitalMarketing.report.compareToggleHint",
                                      "Charts (Spend, CPA, Conv. leads) show monthly data for the chart year. Table and KPIs keep the date filter above.",
                                    )}
                                    className="shrink-0"
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
                                          "digitalMarketing.report.manageTargets",
                                          "KPI targets",
                                        )}
                                      </span>
                                    </Link>
                                  </Button>
                                </>
                              ) : (
                                <div
                                  className="flex items-center justify-end gap-2"
                                  aria-hidden
                                >
                                  <div className="h-9 w-[14rem] shrink-0 rounded-md border border-gray-200 bg-gray-50" />
                                  <div className="h-9 min-w-[200px] w-52 shrink-0 rounded-md border border-gray-300 bg-white" />
                                </div>
                              )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <DigitalMarketingReportSummaryBar
                          bootstrapLoading={showTableSkeletonOverlay}
                          googleServiceRows={googleServiceRows}
                          metaServiceRows={metaServiceRows}
                          tiktokServiceRows={tiktokServiceRows}
                          servicesLoading={
                            googleServicesLoading || metaServicesLoading || tiktokServicesLoading
                          }
                        />

                        <DigitalMarketingReportTable
                          bootstrapLoading={showTableSkeletonOverlay}
                          googleCost={googleCost}
                          metaCost={metaCost}
                          tiktokCost={tiktokCost}
                          googleServiceRows={googleServiceRows}
                          googleServicesLoading={googleServicesLoading}
                          metaServiceRows={metaServiceRows}
                          metaServicesLoading={metaServicesLoading}
                          tiktokServiceRows={tiktokServiceRows}
                          tiktokServicesLoading={tiktokServicesLoading}
                        />

                        <DigitalMarketingReportMonthlyChartsSection
                          bootstrapLoading={showTableSkeletonOverlay}
                          chartPhaseLoading={chartsFetchEnabled && chartLoading}
                          monthlySpend={monthlySpend}
                        />

                        {!googleCost.loading &&
                        !metaCost.loading &&
                        !tiktokCost.loading &&
                        !googleServicesLoading &&
                        !metaServicesLoading &&
                        !tiktokServicesLoading &&
                        (googleCost.connected || metaCost.connected || tiktokCost.connected) &&
                        googleReportHasNoMetrics(googleCost, googleServiceRows) &&
                        metaReportHasNoMetrics(metaCost, metaServiceRows) &&
                        tiktokReportHasNoMetrics(tiktokCost, tiktokServiceRows) ? (
                          <p className="text-center text-sm text-muted-foreground">
                            {t(
                              "digitalMarketing.report.noSpendData",
                              "No spend data for this period.",
                            )}
                          </p>
                        ) : null}
                      </div>
        </div>
        <div
          className={cn(
            "h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4",
          )}
          aria-hidden
        />
      </div>

      {showTableSkeletonOverlay ? (
        <div
          className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
          aria-label={t("digitalMarketing.report.pageLoading", "Loading report")}
        >
          <DigitalMarketingReportTablePhaseSkeleton />
        </div>
      ) : null}
    </div>
  );
}

export default function DigitalMarketingReportPage() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <ModuleHeaderBelowContentGate
                pagePath="/digital-marketing/report"
                header={<HeaderAndTab />}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <DigitalMarketingReportPageWithData />
              </ModuleHeaderBelowContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DigitalMarketingReportPageWithData() {
  const { organizationId } = useCurrentOrg();
  const [chartsFetchEnabled, setChartsFetchEnabled] = useState(false);

  useEffect(() => {
    setChartsFetchEnabled(false);
  }, [organizationId]);

  const handleTablePhaseReady = useMemo(
    () => () => setChartsFetchEnabled(true),
    [],
  );

  return (
    <DigitalMarketingReportDataProvider chartsEnabled={chartsFetchEnabled}>
      <DigitalMarketingReportPageBody
        chartsFetchEnabled={chartsFetchEnabled}
        onTablePhaseReady={handleTablePhaseReady}
      />
    </DigitalMarketingReportDataProvider>
  );
}
