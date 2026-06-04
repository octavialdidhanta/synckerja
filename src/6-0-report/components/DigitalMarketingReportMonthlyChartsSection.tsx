import { useMemo, useState } from "react";
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
import { useDigitalMarketingReportCosts } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
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
  buildReportYearOptions,
  useDigitalMarketingReportMonthlySpend,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import { DigitalMarketingReportMonthlySpendChart } from "@/6-0-report/components/DigitalMarketingReportMonthlySpendChart";
import { DigitalMarketingReportMonthlyCpaChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyCpaChart";
import { DigitalMarketingReportMonthlyLeadsChart } from "@/6-0-report/components/DigitalMarketingReportMonthlyLeadsChart";

const CHANNEL_FILTER_WIDTH = "11.5rem";
const CHANNEL_FILTER_WRAPPER_CLASS = "w-[11.5rem] shrink-0";
const CHANNEL_FILTER_TRIGGER_CLASS =
  "h-9 w-full max-w-full border-gray-200 bg-gray-50 text-sm";
const CHANNEL_FILTER_CONTENT_CLASS = "z-50 bg-white";
const CHANNEL_FILTER_ITEM_CLASS = "w-full min-w-full";

type MonthlyChartTab = "spend" | "cpa" | "leads";

type Props = {
  bootstrapLoading?: boolean;
};

export function DigitalMarketingReportMonthlyChartsSection({ bootstrapLoading }: Props) {
  const { t, language } = useAppTranslation();
  const [chartTab, setChartTab] = useState<MonthlyChartTab>("spend");
  const {
    reportChartYear,
    setReportChartYear,
    monthlyChartChannelFilter,
    setMonthlyChartChannelFilter,
    reportServiceFilter,
  } = useDigitalMarketingPaidAdsFilters();

  const { googleServiceRows, metaServiceRows } = useDigitalMarketingReportCosts();
  const activeServiceName = useMemo(() => {
    const options = buildReportServiceFilterOptions(
      [...googleServiceRows, ...metaServiceRows],
      {
        all: t("digitalMarketing.report.serviceFilterAll", "All services"),
        unmapped: t("digitalMarketing.report.serviceUnmapped", "Belum di-map"),
      },
    );
    return serviceFilterLabel(options, reportServiceFilter);
  }, [googleServiceRows, metaServiceRows, reportServiceFilter, t]);

  const yearOptions = useMemo(() => buildReportYearOptions(6), []);
  const locale = language === "id" ? "id-ID" : "en-US";

  const { selectedYear: year, googleSeries, metaSeries, chartLoading, chartDateOverlap } =
    useDigitalMarketingReportMonthlySpend(reportChartYear);

  const { filteredGoogleRows, filteredMetaRows } = useDigitalMarketingReportFilteredRows(
    googleServiceRows,
    metaServiceRows,
  );

  const combinedScope = useMemo(
    () =>
      buildReportCombinedChannelScope({
        serviceFilterActive: Boolean(reportServiceFilter),
        hasGoogleServiceRow: filteredGoogleRows.length > 0,
        hasMetaServiceRow: filteredMetaRows.length > 0,
        googleConnected: googleSeries.connected,
        metaConnected: metaSeries.connected,
      }),
    [
      reportServiceFilter,
      filteredGoogleRows.length,
      filteredMetaRows.length,
      googleSeries.connected,
      metaSeries.connected,
    ],
  );

  const chartPointsArgs = useMemo(
    () => ({
      year,
      locale,
      google: googleSeries,
      meta: metaSeries,
      combinedScope,
    }),
    [year, locale, googleSeries, metaSeries, combinedScope],
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

  const chartSubtitleBase =
    chartTab === "spend"
      ? t(
          "digitalMarketing.report.monthlySpendSubtitle",
          "Account-level cost by month for the selected year.",
        )
      : chartTab === "cpa"
        ? t(
            "digitalMarketing.report.monthlyCpaSubtitle",
            "Account-level cost per acquisition by month (spend ÷ converted leads with matching campaign UTM).",
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

  const sharedChartProps = {
    bootstrapLoading,
    channelFilter: monthlyChartChannelFilter,
    googleSeries,
    metaSeries,
    combinedScope,
    chartLoading,
    chartDateOverlap,
    embedded: true as const,
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <Tabs
        value={chartTab}
        onValueChange={(v) => setChartTab(v as MonthlyChartTab)}
        className="flex min-w-0 flex-col"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <TabsList className="h-9 bg-gray-100">
              <TabsTrigger value="spend" className="text-sm">
                {t("digitalMarketing.report.monthlyChartTabSpend", "Spend")}
              </TabsTrigger>
              <TabsTrigger value="cpa" className="text-sm">
                {t("digitalMarketing.report.monthlyChartTabCpa", "CPA")}
              </TabsTrigger>
              <TabsTrigger value="leads" className="text-sm">
                {t("digitalMarketing.report.monthlyChartTabLeads", "Conv. leads")}
              </TabsTrigger>
            </TabsList>
            <p className="mt-2 text-xs text-muted-foreground">{chartSubtitle}</p>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-2">
            <div className={CHANNEL_FILTER_WRAPPER_CLASS}>
              <Select
                value={monthlyChartChannelFilter}
                onValueChange={(v) =>
                  setMonthlyChartChannelFilter(v as MonthlyChartChannelFilter)
                }
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
                </SelectContent>
              </Select>
            </div>
            <Select
              value={String(reportChartYear)}
              onValueChange={(v) => setReportChartYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-[5.5rem] shrink-0 border-gray-200 bg-gray-50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-white">
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-w-0" key={chartTab}>
          {chartTab === "spend" ? (
            <DigitalMarketingReportMonthlySpendChart
              {...sharedChartProps}
              chartData={spendChartData}
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
        </div>
      </Tabs>
    </div>
  );
}
