import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endOfDay } from "date-fns";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { DigitalMarketingMobileFooter } from "@/mobile/6-0-digital-marketing/components/DigitalMarketingMobileFooter";
import { ReportMobileShellHeader } from "@/mobile/6-0-report/components/ReportMobileShellHeader";
import { MobileReportSummaryBar } from "@/mobile/6-0-report/components/MobileReportSummaryBar";
import { MobileReportFilterStrip } from "@/mobile/6-0-report/components/MobileReportFilterStrip";
import { MobileReportTable } from "@/mobile/6-0-report/components/MobileReportTable";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import { cn } from "@/shared/lib/utils";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  DigitalMarketingReportDataProvider,
  useDigitalMarketingReportData,
} from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import { buildReportServiceFilterOptions } from "@/6-0-digital-marketing-shared/reportServiceFilter";
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { computePresetRange, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { DigitalMarketingReportMonthlyChartsSection } from "@/6-0-report/components/DigitalMarketingReportMonthlyChartsSection";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { REPORT_SUMMARY_MOBILE_SLOT_COUNT } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

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

function MobileReportTablePhaseSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-2 px-2 pt-2">
      <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
        {Array.from({ length: REPORT_SUMMARY_MOBILE_SLOT_COUNT }, (_, i) => (
          <div key={i} className="bg-card px-4 py-3">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="-mx-2 border-y border-border bg-card px-2 py-2">
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-11 w-36 shrink-0" />
          <Skeleton className="h-11 w-32 shrink-0" />
          <Skeleton className="h-11 w-20 shrink-0" />
        </div>
      </div>
      <div className="-mx-2 space-y-2 border-y border-border bg-card p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

type ReportBodyProps = {
  chartsFetchEnabled: boolean;
  onTablePhaseReady: () => void;
  hasPageAccess: boolean;
};

function MobileDigitalMarketingReportPageBody({
  chartsFetchEnabled,
  onTablePhaseReady,
  hasPageAccess,
}: ReportBodyProps) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
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

  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

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

  const handleCustomDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      setCustomDateRange({ start: startDate, end: endDate });
      setDateSelection({
        preset: "custom",
        range: { from: startDate, to: endOfDay(endDate) },
        rollingDays: 30,
      });
    },
    [setDateSelection],
  );

  const servicesLoading =
    googleServicesLoading || metaServicesLoading || tiktokServicesLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <ReportMobileShellHeader />

          <ModuleShellContentGate
            pagePath={MOBILE_PAGE_PATH.digitalMarketingReport}
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? (
              <>
                <div
                  className={cn(
                    "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    showTableSkeletonOverlay && "pointer-events-none opacity-0",
                  )}
                  aria-hidden={showTableSkeletonOverlay}
                >
                  <div className="mx-auto w-full max-w-md space-y-2 px-2 pt-2 pb-[calc(0.5rem+3.25rem+env(safe-area-inset-bottom,0px))] [[data-synckerja-android-native]_&]:pb-[calc(0.5rem+3.25rem)]">
                    <MobileReportSummaryBar
                      bootstrapLoading={showTableSkeletonOverlay}
                      googleServiceRows={googleServiceRows}
                      metaServiceRows={metaServiceRows}
                      tiktokServiceRows={tiktokServiceRows}
                      servicesLoading={servicesLoading}
                    />

                    <MobileReportFilterStrip
                      dateSelection={dateSelection}
                      onDateSelectionChange={setDateSelection}
                      filtersHydrated={filtersHydrated}
                      calendarYearPresetYears={calendarYearPresetYears}
                      accountEarliestYmd={accountDateBounds?.earliest_date}
                      allTimeHint={t(
                        "digitalMarketing.report.allTimeRangeHint",
                        "All time: Google cost uses full account history from first activity. Meta cost uses the last 37 months (Meta API limit).",
                      )}
                      calendarYearFilterHint={t(
                        "digitalMarketing.report.calendarYearFilterHint",
                        "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                      )}
                      onCustomDateClick={() => setShowCustomDatePicker(true)}
                      compareEnabled={reportChartCompareEnabled}
                      onCompareChange={setReportChartCompareEnabled}
                      serviceOptions={serviceFilterOptions}
                      serviceFilter={reportServiceFilter}
                      onServiceFilterChange={setReportServiceFilter}
                    />

                    <MobileReportTable
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

                    <div className="-mx-2 min-w-0">
                      <DigitalMarketingReportMonthlyChartsSection
                        variant="mobile"
                        bootstrapLoading={showTableSkeletonOverlay}
                        chartPhaseLoading={chartsFetchEnabled && chartLoading}
                        monthlySpend={monthlySpend}
                      />
                    </div>

                    {!googleCost.loading &&
                    !metaCost.loading &&
                    !tiktokCost.loading &&
                    !servicesLoading &&
                    (googleCost.connected || metaCost.connected || tiktokCost.connected) &&
                    googleReportHasNoMetrics(googleCost, googleServiceRows) &&
                    metaReportHasNoMetrics(metaCost, metaServiceRows) &&
                    tiktokReportHasNoMetrics(tiktokCost, tiktokServiceRows) ? (
                      <p className="px-2 text-center text-sm text-muted-foreground">
                        {t(
                          "digitalMarketing.report.noSpendData",
                          "No spend data for this period.",
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                {showTableSkeletonOverlay ? (
                  <div
                    className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/70"
                    aria-busy
                    aria-label={t("digitalMarketing.report.pageLoading", "Loading report")}
                  >
                    <MobileReportTablePhaseSkeleton />
                  </div>
                ) : null}
              </>
            ) : null}
          </ModuleShellContentGate>

          {!isKeyboardShellOpen ? (
            <DigitalMarketingMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>

      <CustomDatePicker
        isOpen={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        onDateRangeSelect={handleCustomDateRange}
        initialStartDate={customDateRange?.start ?? dateSelection.range.from ?? undefined}
        initialEndDate={customDateRange?.end ?? dateSelection.range.to ?? undefined}
      />
    </SidebarProvider>
  );
}

function MobileDigitalMarketingReportPageWithData({ hasPageAccess }: { hasPageAccess: boolean }) {
  const { organizationId } = useCurrentOrg();
  const [chartsFetchEnabled, setChartsFetchEnabled] = useState(false);

  useEffect(() => {
    setChartsFetchEnabled(false);
  }, [organizationId]);

  const handleTablePhaseReady = useMemo(() => () => setChartsFetchEnabled(true), []);

  return (
    <DigitalMarketingReportDataProvider chartsEnabled={chartsFetchEnabled}>
      <MobileDigitalMarketingReportPageBody
        chartsFetchEnabled={chartsFetchEnabled}
        onTablePhaseReady={handleTablePhaseReady}
        hasPageAccess={hasPageAccess}
      />
    </DigitalMarketingReportDataProvider>
  );
}

export default function MobileDigitalMarketingReportPage() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingReport;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  if (showDenyShellHeader) {
    return (
      <SidebarProvider>
        <div className={cn(outerShellClassName, "bg-muted/70")}>
          <AppSidebar />
          <main
            className={cn(
              "z-0 flex w-full min-w-0 max-w-none flex-col bg-muted/70",
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            <ReportMobileShellHeader />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-default"
            />
            {!isKeyboardShellOpen ? (
              <DigitalMarketingMobileFooter className="safe-area-bottom-lower" />
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return <MobileDigitalMarketingReportPageWithData hasPageAccess={hasPageAccess} />;
}
