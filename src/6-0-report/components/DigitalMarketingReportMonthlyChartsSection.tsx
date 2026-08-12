import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useDigitalMarketingReportData } from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import {
  buildReportCombinedChannelScope,
  buildReportServiceFilterOptions,
  serviceFilterLabel,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import {
  buildMonthlyCpaChartPoints,
  buildMonthlyLeadsChartPoints,
  buildMonthlySpendChartPoints,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { DigitalMarketingReportDataContextValue } from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import { DigitalMarketingReportChartsSkeleton } from "@/6-0-report/skeletons/DigitalMarketingReportChartsSkeleton";
import { isMetaSeriesChartSkipped, isTikTokSeriesChartSkipped } from "@/6-0-digital-marketing-shared/monthlyReportChartDisplay";
import { DigitalMarketingReportMonthlySpendChart } from "@/6-0-report/components/DigitalMarketingReportMonthlySpendChart";
import { DigitalMarketingReportMonthlyCpaChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyCpaChart";
import { DigitalMarketingReportMonthlyLeadsChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyLeadsChart";
import { DigitalMarketingReportMonthlySpendByServiceChart } from "@/6-0-report/components/DigitalMarketingReportMonthlySpendByServiceChart";
import { DigitalMarketingReportMonthlyLeadsByServiceChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyLeadsByServiceChart";
import { DigitalMarketingReportMonthlyCpaByServiceChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyCpaByServiceChart";
import { useDigitalMarketingReportMonthlySpendByService } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpendByService";
import { useDigitalMarketingReportMonthlyLeadsByService } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlyLeadsByService";
import { buildCpaByServiceTotalsChartPoints } from "@/6-0-digital-marketing-shared/reportMonthlyCpaByService";

const CHANNEL_FILTER_WIDTH = "11.5rem";
const CHANNEL_FILTER_WRAPPER_CLASS = "w-[11.5rem] shrink-0";
const CHANNEL_FILTER_TRIGGER_CLASS =
  "h-9 w-full max-w-full border-gray-200 bg-gray-50 text-sm";
const CHANNEL_FILTER_CONTENT_CLASS = "z-50 bg-white";
const CHANNEL_FILTER_ITEM_CLASS = "w-full min-w-full";

type MonthlyChartTab =
  | "spend"
  | "spend_service"
  | "service_converted"
  | "cost_service_converted"
  | "cpa"
  | "leads";

type Props = {
  bootstrapLoading?: boolean;
  chartPhaseLoading?: boolean;
  monthlySpend: DigitalMarketingReportDataContextValue["monthlySpend"];
  /** Mobile report: full-bleed card + horizontally scrollable tabs/filter strip. */
  variant?: "default" | "mobile";
};

export function DigitalMarketingReportMonthlyChartsSection({
  bootstrapLoading,
  chartPhaseLoading = false,
  monthlySpend,
  variant = "default",
}: Props) {
  const isMobile = variant === "mobile";
  const { t, language } = useAppTranslation();
  const [chartTab, setChartTab] = useState<MonthlyChartTab>("spend");
  const {
    dateSelection,
    monthlyChartChannelFilter,
    setMonthlyChartChannelFilter,
    reportServiceFilter,
  } = useDigitalMarketingPaidAdsFilters();

  const chartUsesAllTime = dateSelection.preset === "all_time";
  const showServiceBreakdownTabs = !reportServiceFilter;

  const { googleServiceRows, metaServiceRows, tiktokServiceRows } = useDigitalMarketingReportData();

  useEffect(() => {
    if (
      !showServiceBreakdownTabs &&
      (chartTab === "spend_service" ||
        chartTab === "service_converted" ||
        chartTab === "cost_service_converted")
    ) {
      setChartTab("spend");
    }
  }, [showServiceBreakdownTabs, chartTab]);
  const activeServiceName = useMemo(() => {
    const options = buildReportServiceFilterOptions(
      [...googleServiceRows, ...metaServiceRows, ...tiktokServiceRows],
      {
        all: t("digitalMarketing.report.serviceFilterAll", "All services"),
        unmapped: t("digitalMarketing.report.serviceUnmapped", "Belum di-map"),
      },
    );
    return serviceFilterLabel(options, reportServiceFilter);
  }, [googleServiceRows, metaServiceRows, tiktokServiceRows, reportServiceFilter, t]);

  const locale = language === "id" ? "id-ID" : "en-US";

  const {
    selectedYear: year,
    chartSpanMode,
    compareActive,
    googleSeries,
    metaSeries,
    tiktokSeries,
    chartLoading,
    chartDateOverlap,
  } = monthlySpend;

  const isServiceBreakdownTab =
    chartTab === "spend_service" ||
    chartTab === "service_converted" ||
    chartTab === "cost_service_converted";
  const serviceBreakdownFetchEnabled = showServiceBreakdownTabs && isServiceBreakdownTab;

  const { filteredGoogleRows, filteredMetaRows, filteredTikTokRows } =
    useDigitalMarketingReportFilteredRows(
      googleServiceRows,
      metaServiceRows,
      tiktokServiceRows,
    );

  const combinedScope = useMemo(() => {
    const base = buildReportCombinedChannelScope({
      serviceFilterActive: Boolean(reportServiceFilter),
      hasGoogleServiceRow: filteredGoogleRows.length > 0,
      hasMetaServiceRow: filteredMetaRows.length > 0,
      hasTikTokServiceRow: filteredTikTokRows.length > 0,
      googleConnected: googleSeries.connected,
      metaConnected: metaSeries.connected,
      tiktokConnected: tiktokSeries.connected,
    });
    return {
      includeGoogle: base.includeGoogle,
      includeMeta: base.includeMeta && !isMetaSeriesChartSkipped(metaSeries),
      includeTikTok: base.includeTikTok && !isTikTokSeriesChartSkipped(tiktokSeries),
    };
  }, [
    reportServiceFilter,
    filteredGoogleRows.length,
    filteredMetaRows.length,
    filteredTikTokRows.length,
    googleSeries.connected,
    metaSeries.connected,
    tiktokSeries.connected,
    metaSeries.unavailableReason,
    tiktokSeries.unavailableReason,
  ]);

  const chartPointsArgs = useMemo(
    () => ({
      year,
      locale,
      spanMode: chartSpanMode,
      google: googleSeries,
      meta: metaSeries,
      tiktok: tiktokSeries,
      combinedScope,
    }),
    [year, locale, chartSpanMode, googleSeries, metaSeries, tiktokSeries, combinedScope],
  );

  const spendChartData = useMemo(
    () => buildMonthlySpendChartPoints(chartPointsArgs),
    [chartPointsArgs],
  );

  const cpaChartData = useMemo(
    () => buildMonthlyCpaChartPoints(chartPointsArgs),
    [chartPointsArgs],
  );

  const leadsChartData = useMemo(
    () => buildMonthlyLeadsChartPoints(chartPointsArgs),
    [chartPointsArgs],
  );

  const unmappedLabel = t("digitalMarketing.report.serviceUnmapped", "Belum di-map");
  const {
    chartData: spendByServiceChartData,
    loading: spendByServiceLoading,
    currency: spendByServiceCurrency,
    error: spendByServiceError,
  } = useDigitalMarketingReportMonthlySpendByService({
    enabled: serviceBreakdownFetchEnabled,
    selectedYear: year,
    chartSpanMode,
    googleServiceRows,
    metaServiceRows,
    unmappedLabel,
    chartDateOverlap,
  });

  const {
    chartData: leadsByServiceChartData,
    loading: leadsByServiceLoading,
    error: leadsByServiceError,
  } = useDigitalMarketingReportMonthlyLeadsByService({
    enabled: serviceBreakdownFetchEnabled,
    selectedYear: year,
    chartSpanMode,
    googleServiceRows,
    metaServiceRows,
    unmappedLabel,
    chartDateOverlap,
  });

  const cpaByServiceChartData = useMemo(
    () =>
      showServiceBreakdownTabs
        ? buildCpaByServiceTotalsChartPoints(
            spendByServiceChartData,
            leadsByServiceChartData,
          )
        : [],
    [showServiceBreakdownTabs, spendByServiceChartData, leadsByServiceChartData],
  );

  const serviceBreakdownLoading = spendByServiceLoading || leadsByServiceLoading;
  const serviceBreakdownError = spendByServiceError ?? leadsByServiceError;

  const compareChartSubtitle =
    chartTab === "spend"
      ? t(
          "digitalMarketing.report.monthlySpendSubtitleCompare",
          "Monthly cost for {{year}} (Compare). Table and KPIs still use the date filter above.",
          { year },
        )
      : chartTab === "cpa"
        ? t(
            "digitalMarketing.report.monthlyCpaSubtitleCompare",
            "Monthly CPA for {{year}} (Compare). Table and KPIs still use the date filter above.",
            { year },
          )
        : chartTab === "leads"
          ? t(
              "digitalMarketing.report.monthlyLeadsSubtitleCompare",
              "Monthly converted leads for {{year}} (Compare). Table and KPIs still use the date filter above.",
              { year },
            )
          : "";

  const chartSubtitleBase =
    chartTab === "spend_service"
      ? t(
          "digitalMarketing.report.monthlySpendByServiceSubtitle",
          "Total cost per service for the selected date range and channel filter.",
        )
      : chartTab === "service_converted"
        ? t(
            "digitalMarketing.report.monthlyLeadsByServiceSubtitle",
            "Total converted leads per service for the selected date range and channel filter.",
          )
        : chartTab === "cost_service_converted"
          ? t(
              "digitalMarketing.report.monthlyCpaByServiceSubtitle",
              "Cost per converted lead (CPA) per service for the selected date range and channel filter.",
            )
      : compareActive
        ? compareChartSubtitle
        : chartTab === "spend"
          ? chartUsesAllTime
            ? ""
            : t(
                "digitalMarketing.report.monthlySpendSubtitle",
                "Account-level cost by month for the selected year.",
              )
          : chartTab === "cpa"
            ? chartUsesAllTime
              ? t(
                  "digitalMarketing.report.monthlyCpaSubtitleAllTime",
                  "Account-level CPA by calendar month (Jan–Dec), aggregated across the selected date range (spend ÷ converted leads with matching campaign UTM).",
                )
              : t(
                  "digitalMarketing.report.monthlyCpaSubtitle",
                  "Account-level cost per acquisition by month (spend ÷ converted leads with matching campaign UTM).",
                )
            : chartUsesAllTime
              ? t(
                  "digitalMarketing.report.monthlyLeadsSubtitleAllTime",
                  "Distinct converted leads by calendar month (Jan–Dec), aggregated across the selected date range (matching campaign UTM).",
                )
              : t(
                  "digitalMarketing.report.monthlyLeadsSubtitle",
                  "Distinct converted leads per month (matching campaign UTM, by conversion date).",
                );

  const chartSubtitle = activeServiceName
    ? t("digitalMarketing.report.monthlyChartSubtitleForService", "{{base}} Filtered by service: {{service}}.", {
        base: chartSubtitleBase,
        service: activeServiceName,
      })
    : chartSubtitleBase;

  const plotClassName = isMobile ? "h-[220px]" : "h-[300px]";

  const sharedChartProps = {
    bootstrapLoading,
    channelFilter: monthlyChartChannelFilter,
    googleSeries,
    metaSeries,
    tiktokSeries,
    combinedScope,
    chartLoading,
    chartDateOverlap,
    embedded: true as const,
    plotClassName,
  };

  if (chartPhaseLoading) {
    return <DigitalMarketingReportChartsSkeleton variant={variant} />;
  }

  const tabTriggerClass = isMobile ? "shrink-0 text-xs" : "text-sm";

  const channelFilterSelect = (
    <Select
      value={monthlyChartChannelFilter}
      onValueChange={(v) => setMonthlyChartChannelFilter(v as MonthlyChartChannelFilter)}
    >
      <SelectTrigger className={CHANNEL_FILTER_TRIGGER_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className={CHANNEL_FILTER_CONTENT_CLASS}
        style={{ width: CHANNEL_FILTER_WIDTH, minWidth: CHANNEL_FILTER_WIDTH }}
      >
        <SelectItem value="all" className={CHANNEL_FILTER_ITEM_CLASS}>
          {t("digitalMarketing.report.monthlySpendFilterAll", "All channels")}
        </SelectItem>
        <SelectItem value="by_channel" className={CHANNEL_FILTER_ITEM_CLASS}>
          {t("digitalMarketing.report.monthlySpendFilterByChannel", "By channel")}
        </SelectItem>
        {googleSeries.connected ? (
          <SelectItem value="google" className={CHANNEL_FILTER_ITEM_CLASS}>
            {t("digitalMarketing.report.channelGoogle", "Google Ads")}
          </SelectItem>
        ) : null}
        {metaSeries.connected ? (
          <SelectItem value="meta" className={CHANNEL_FILTER_ITEM_CLASS}>
            {t("digitalMarketing.report.channelMeta", "Meta Ads")}
          </SelectItem>
        ) : null}
        {tiktokSeries.connected ? (
          <SelectItem value="tiktok" className={CHANNEL_FILTER_ITEM_CLASS}>
            {t("digitalMarketing.report.channelTikTok", "TikTok Ads")}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );

  const chartTabs = (
    <TabsList
      className={
        isMobile
          ? "h-9 w-max shrink-0 justify-start bg-gray-100"
          : "h-9 bg-gray-100"
      }
    >
      <TabsTrigger value="spend" className={tabTriggerClass}>
        {t("digitalMarketing.report.monthlyChartTabSpend", "Spend")}
      </TabsTrigger>
      <TabsTrigger value="cpa" className={tabTriggerClass}>
        {t("digitalMarketing.report.monthlyChartTabCpa", "CPA")}
      </TabsTrigger>
      <TabsTrigger value="leads" className={tabTriggerClass}>
        {t("digitalMarketing.report.monthlyChartTabLeads", "Conv. leads")}
      </TabsTrigger>
      {showServiceBreakdownTabs ? (
        <>
          <TabsTrigger value="spend_service" className={tabTriggerClass}>
            {t("digitalMarketing.report.monthlyChartTabSpendByService", "Spend/Service")}
          </TabsTrigger>
          <TabsTrigger value="service_converted" className={tabTriggerClass}>
            {t(
              "digitalMarketing.report.monthlyChartTabServiceConverted",
              "Service Converted",
            )}
          </TabsTrigger>
          <TabsTrigger value="cost_service_converted" className={tabTriggerClass}>
            {t(
              "digitalMarketing.report.monthlyChartTabCostServiceConverted",
              "CPA Service",
            )}
          </TabsTrigger>
        </>
      ) : null}
    </TabsList>
  );

  const chartBody = (
    <>
      {chartTab === "spend" ? (
        <DigitalMarketingReportMonthlySpendChart
          {...sharedChartProps}
          chartData={spendChartData}
        />
      ) : chartTab === "spend_service" ? (
        <DigitalMarketingReportMonthlySpendByServiceChart
          bootstrapLoading={bootstrapLoading}
          channelFilter={monthlyChartChannelFilter}
          chartData={spendByServiceChartData}
          googleSeries={googleSeries}
          metaSeries={metaSeries}
          tiktokSeries={tiktokSeries}
          chartLoading={serviceBreakdownLoading}
          chartDateOverlap={chartDateOverlap}
          currency={spendByServiceCurrency}
          error={serviceBreakdownError}
          embedded
        />
      ) : chartTab === "service_converted" ? (
        <DigitalMarketingReportMonthlyLeadsByServiceChart
          bootstrapLoading={bootstrapLoading}
          channelFilter={monthlyChartChannelFilter}
          chartData={leadsByServiceChartData}
          googleSeries={googleSeries}
          metaSeries={metaSeries}
          tiktokSeries={tiktokSeries}
          chartLoading={serviceBreakdownLoading}
          chartDateOverlap={chartDateOverlap}
          error={serviceBreakdownError}
          embedded
        />
      ) : chartTab === "cost_service_converted" ? (
        <DigitalMarketingReportMonthlyCpaByServiceChart
          bootstrapLoading={bootstrapLoading}
          channelFilter={monthlyChartChannelFilter}
          chartData={cpaByServiceChartData}
          googleSeries={googleSeries}
          metaSeries={metaSeries}
          tiktokSeries={tiktokSeries}
          chartLoading={serviceBreakdownLoading}
          chartDateOverlap={chartDateOverlap}
          currency={spendByServiceCurrency}
          error={serviceBreakdownError}
          embedded
        />
      ) : chartTab === "cpa" ? (
        <DigitalMarketingReportMonthlyCpaChart
          {...sharedChartProps}
          chartData={cpaChartData}
        />
      ) : (
        <DigitalMarketingReportMonthlyLeadsChart
          {...sharedChartProps}
          chartData={leadsChartData}
        />
      )}
    </>
  );

  return (
    <div
      className={
        isMobile
          ? "border-y border-border bg-card"
          : "overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      }
    >
      <Tabs
        value={chartTab}
        onValueChange={(v) => setChartTab(v as MonthlyChartTab)}
        className="flex min-w-0 flex-col"
      >
        {isMobile ? (
          <>
            <div
              className={
                "scrollbar-hide seamless-scroll min-w-0 overflow-x-auto overflow-y-hidden " +
                "[touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              }
            >
              <div className="inline-flex items-center gap-2 pb-0.5 pt-3">
                <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
                {chartTabs}
                <div className={`${CHANNEL_FILTER_WRAPPER_CLASS} shrink-0`}>
                  {channelFilterSelect}
                </div>
                <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
              </div>
            </div>
            {chartSubtitle ? (
              <p className="mt-2 px-4 text-xs text-muted-foreground">{chartSubtitle}</p>
            ) : null}
            <div className="min-w-0 px-4 pb-3 pt-2 [&_.h-\[300px\]]:!h-[220px]" key={chartTab}>
              {chartBody}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {chartTabs}
                {chartSubtitle ? (
                  <p className="mt-2 text-xs text-muted-foreground">{chartSubtitle}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                <div className={CHANNEL_FILTER_WRAPPER_CLASS}>{channelFilterSelect}</div>
              </div>
            </div>
            <div className="min-h-[300px] min-w-0" key={chartTab}>
              {chartBody}
            </div>
          </>
        )}
      </Tabs>
    </div>
  );
}
