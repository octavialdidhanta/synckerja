import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  buildMonthlySpendChartPoints,
  buildReportYearOptions,
  useDigitalMarketingReportMonthlySpend,
  type MonthlySpendChannelFilter,
  type ReportMonthlySpendChartPoint,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

const GOOGLE_BAR = "hsl(204 70% 42%)";
const META_BAR = "hsl(262 55% 52%)";
/** Combined all-channel total — distinct from Google (blue) and Meta (purple). */
const COMBINED_BAR = "hsl(160 52% 36%)";
/** Fixed width so trigger & dropdown stay consistent for All / By channel / Google / Meta. */
const CHANNEL_FILTER_WIDTH = "11.5rem";
const CHANNEL_FILTER_WRAPPER_CLASS = "w-[11.5rem] shrink-0";
const CHANNEL_FILTER_TRIGGER_CLASS =
  "h-9 w-full max-w-full border-gray-200 bg-gray-50 text-sm";
const CHANNEL_FILTER_CONTENT_CLASS = "z-50 bg-white";
const CHANNEL_FILTER_ITEM_CLASS = "w-full min-w-full";

const WIDE_MONTHLY_BAR_LAYOUT = {
  barCategoryGap: "1%" as const,
  barGap: 0,
  combinedBarSize: 94,
  singleBarSize: 94,
  groupedBarSize: 34,
};

const GROUPED_MONTHLY_BAR_LAYOUT = {
  barCategoryGap: "3%" as const,
  barGap: 5,
  combinedBarSize: 94,
  singleBarSize: 94,
  groupedBarSize: 42,
};

function formatAxisTick(value: number, currency: string | null): string {
  const code = (currency ?? "IDR").toUpperCase();
  if (code === "IDR") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
    return String(Math.round(value));
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatSpendTooltip(
  value: number,
  channel: "google" | "meta" | "combined",
  currency: string | null,
): string {
  if (channel === "google") {
    return formatMetricValue("spent", value, currency, "micros");
  }
  if (channel === "meta") {
    return formatMetaMetricValue("spend", value, currency);
  }
  return formatMetaMetricValue("spend", value, currency);
}

type SpendTooltipProps = TooltipProps<number, string> & {
  channelFilter: MonthlySpendChannelFilter;
  googleCurrency: string | null;
  metaCurrency: string | null;
  showGoogle: boolean;
  showMeta: boolean;
  mixedCurrency: boolean;
  labels: {
    total: string;
    google: string;
    meta: string;
    mixedHint: string;
  };
};

function SpendTooltip({
  active,
  payload,
  label,
  channelFilter,
  googleCurrency,
  metaCurrency,
  showGoogle,
  showMeta,
  mixedCurrency,
  labels,
}: SpendTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ReportMonthlySpendChartPoint | undefined;
  if (!row) return null;

  if (channelFilter === "all") {
    const primaryCurrency =
      googleCurrency && metaCurrency && googleCurrency === metaCurrency
        ? googleCurrency
        : (googleCurrency ?? metaCurrency);
    return (
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-gray-900">{label}</p>
        <p className="tabular-nums text-gray-900">
          {labels.total}: {formatSpendTooltip(row.totalSpend, "combined", primaryCurrency)}
        </p>
        {showGoogle && row.googleSpend > 0 ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            {labels.google}: {formatSpendTooltip(row.googleSpend, "google", googleCurrency)}
          </p>
        ) : null}
        {showMeta && row.metaSpend > 0 ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            {labels.meta}: {formatSpendTooltip(row.metaSpend, "meta", metaCurrency)}
          </p>
        ) : null}
        {mixedCurrency ? (
          <p className="mt-1 text-[11px] text-amber-700">{labels.mixedHint}</p>
        ) : null}
      </div>
    );
  }

  const entry = payload[0];
  const value = Number(entry?.value ?? 0);
  const name = String(entry?.name ?? "");
  const isGoogle = name === "googleSpend";
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      <p className="tabular-nums text-gray-900">
        {isGoogle ? labels.google : labels.meta}:{" "}
        {formatSpendTooltip(
          value,
          isGoogle ? "google" : "meta",
          isGoogle ? googleCurrency : metaCurrency,
        )}
      </p>
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
};

export function DigitalMarketingReportMonthlySpendChart({ bootstrapLoading }: Props) {
  const { t, language } = useAppTranslation();
  const [channelFilter, setChannelFilter] = useState<MonthlySpendChannelFilter>("all");
  const { reportChartYear, setReportChartYear } = useDigitalMarketingPaidAdsFilters();
  const yearOptions = useMemo(() => buildReportYearOptions(6), []);

  const { selectedYear: year, googleSeries, metaSeries, chartLoading, chartDateOverlap } =
    useDigitalMarketingReportMonthlySpend(reportChartYear);

  const chartData = useMemo(
    () =>
      buildMonthlySpendChartPoints({
        year,
        locale: language === "id" ? "id-ID" : "en-US",
        google: googleSeries,
        meta: metaSeries,
      }),
    [year, language, googleSeries, metaSeries],
  );

  const showGoogle = googleSeries.connected && channelFilter !== "meta";
  const showMeta = metaSeries.connected && channelFilter !== "google";
  const showCombined = channelFilter === "all";
  const showGrouped = channelFilter === "by_channel";

  const mixedCurrency =
    googleSeries.connected &&
    metaSeries.connected &&
    googleSeries.currency != null &&
    metaSeries.currency != null &&
    googleSeries.currency !== metaSeries.currency;

  const axisCurrency =
    showCombined && !mixedCurrency
      ? (googleSeries.currency ?? metaSeries.currency)
      : channelFilter === "google"
        ? googleSeries.currency
        : channelFilter === "meta"
          ? metaSeries.currency
          : showGoogle && showMeta && mixedCurrency
            ? null
            : (googleSeries.currency ?? metaSeries.currency);

  const hasData = chartData.some((row) => {
    if (channelFilter === "all") return row.totalSpend > 0;
    if (channelFilter === "google") return row.googleSpend > 0;
    if (channelFilter === "meta") return row.metaSpend > 0;
    return row.googleSpend > 0 || row.metaSpend > 0;
  });

  const loading = bootstrapLoading || chartLoading;

  const barChartSpacing = useMemo(() => {
    if (showCombined || channelFilter === "google" || channelFilter === "meta") {
      return WIDE_MONTHLY_BAR_LAYOUT;
    }
    if (showGrouped) {
      return GROUPED_MONTHLY_BAR_LAYOUT;
    }
    return {
      barCategoryGap: "12%",
      barGap: 0,
      combinedBarSize: 52,
      singleBarSize: 52,
      groupedBarSize: 34,
    };
  }, [showCombined, showGrouped, channelFilter]);

  const tooltipLabels = useMemo(
    () => ({
      total: t("digitalMarketing.report.monthlySpendFilterAll", "All channels"),
      google: t("digitalMarketing.report.channelGoogle", "Google Ads"),
      meta: t("digitalMarketing.report.channelMeta", "Meta Ads"),
      mixedHint: t(
        "digitalMarketing.report.monthlySpendMixedCurrencyHint",
        "Totals add amounts in different currencies without conversion.",
      ),
    }),
    [t],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">
            {t("digitalMarketing.report.monthlySpendTitle", "Monthly spend trend")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(
              "digitalMarketing.report.monthlySpendSubtitle",
              "Account-level cost by month for the selected year.",
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <div className={CHANNEL_FILTER_WRAPPER_CLASS}>
            <Select
              value={channelFilter}
              onValueChange={(v) => setChannelFilter(v as MonthlySpendChannelFilter)}
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

      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-md" />
      ) : !googleSeries.connected && !metaSeries.connected ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t(
            "digitalMarketing.report.monthlySpendNotConnected",
            "Connect Google Ads or Meta Ads to see monthly spend.",
          )}
        </div>
      ) : !chartDateOverlap ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {t(
            "digitalMarketing.report.monthlySpendNoOverlap",
            "The date filter does not overlap the selected chart year. Adjust the date range or chart year.",
          )}
        </div>
      ) : googleSeries.error || metaSeries.error ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-red-600">
          {googleSeries.error ?? metaSeries.error}
        </div>
      ) : !hasData ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t("digitalMarketing.report.monthlySpendEmpty", "No spend data for this year.")}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-4">
            {showCombined ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: COMBINED_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.monthlySpendFilterAll", "All channels")}
                {axisCurrency ? ` (${axisCurrency})` : mixedCurrency ? " (mixed)" : ""}
              </span>
            ) : null}
            {showGrouped && showGoogle ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: GOOGLE_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelGoogle", "Google Ads")}
                {googleSeries.currency ? ` (${googleSeries.currency})` : ""}
              </span>
            ) : null}
            {showGrouped && showMeta ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: META_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelMeta", "Meta Ads")}
                {metaSeries.currency ? ` (${metaSeries.currency})` : ""}
              </span>
            ) : null}
            {channelFilter === "google" ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: GOOGLE_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelGoogle", "Google Ads")}
                {googleSeries.currency ? ` (${googleSeries.currency})` : ""}
              </span>
            ) : null}
            {channelFilter === "meta" ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: META_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelMeta", "Meta Ads")}
                {metaSeries.currency ? ` (${metaSeries.currency})` : ""}
              </span>
            ) : null}
          </div>
          {showCombined && mixedCurrency ? (
            <p className="mb-2 text-[11px] text-amber-700">
              {tooltipLabels.mixedHint}
            </p>
          ) : null}
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                barCategoryGap={barChartSpacing.barCategoryGap}
                barGap={barChartSpacing.barGap}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="shortMonth"
                  fontSize={11}
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={10}
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => formatAxisTick(Number(v), axisCurrency)}
                />
                <Tooltip
                  content={
                    <SpendTooltip
                      channelFilter={channelFilter}
                      googleCurrency={googleSeries.currency}
                      metaCurrency={metaSeries.currency}
                      showGoogle={googleSeries.connected}
                      showMeta={metaSeries.connected}
                      mixedCurrency={mixedCurrency}
                      labels={tooltipLabels}
                    />
                  }
                />
                {showCombined ? (
                  <Bar
                    dataKey="totalSpend"
                    fill={COMBINED_BAR}
                    radius={[4, 4, 0, 0]}
                    name="totalSpend"
                    barSize={barChartSpacing.combinedBarSize}
                  />
                ) : null}
                {showGrouped && showGoogle ? (
                  <Bar
                    dataKey="googleSpend"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleSpend"
                    barSize={showMeta ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                  />
                ) : null}
                {showGrouped && showMeta ? (
                  <Bar
                    dataKey="metaSpend"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaSpend"
                    barSize={showGoogle ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                  />
                ) : null}
                {channelFilter === "google" ? (
                  <Bar
                    dataKey="googleSpend"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleSpend"
                    barSize={barChartSpacing.singleBarSize}
                  />
                ) : null}
                {channelFilter === "meta" ? (
                  <Bar
                    dataKey="metaSpend"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaSpend"
                    barSize={barChartSpacing.singleBarSize}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
