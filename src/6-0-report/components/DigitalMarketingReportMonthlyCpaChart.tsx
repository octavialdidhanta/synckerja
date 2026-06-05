import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import type {
  MonthlySpendChannelFilter,
  MonthlySpendChannelSeries,
  ReportMonthlyCpaChartPoint,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import {
  getMonthlyChartBlockingError,
  hasMonthlyChartDisplayableChannel,
  isGoogleSeriesChartActive,
  isMetaSeriesChartActive,
  isMetaSeriesChartSkipped,
} from "@/6-0-digital-marketing-shared/monthlyReportChartDisplay";
import type { ReportCombinedChannelScope } from "@/6-0-digital-marketing-shared/reportServiceFilter";

const GOOGLE_BAR = "hsl(204 70% 42%)";
const META_BAR = "hsl(262 55% 52%)";
const COMBINED_BAR = "hsl(160 52% 36%)";

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

function formatCpaAxisTick(value: number, currency: string | null): string {
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

function formatCpaValue(value: number, currency: string | null): string {
  const code = (currency ?? "IDR").toUpperCase();
  if (code === "IDR") {
    return formatMetaMetricValue("spend", value, currency);
  }
  return formatMetricValue("spent", value, currency, "micros");
}

function formatCpaBarLabel(value: unknown, currency: string | null): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatCpaValue(n, currency);
}

function resolveLabelNumericValue(
  raw: number | string | Array<number | string> | undefined,
  payload: ReportMonthlyCpaChartPoint | undefined,
  dataKey: keyof ReportMonthlyCpaChartPoint,
): number | null {
  if (Array.isArray(raw)) {
    const first = raw[0];
    const n = typeof first === "number" ? first : Number(first);
    if (Number.isFinite(n)) return n;
  } else if (raw != null && raw !== "") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  if (payload) {
    const fromRow = payload[dataKey];
    if (fromRow == null) return null;
    const n = typeof fromRow === "number" ? fromRow : Number(fromRow);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Recharts 2 `formatter` on LabelList does not receive raw bar values — use `content` instead. */
function createCpaBarLabelRenderer(
  currency: string | null,
  dataKey: "totalCpa" | "googleCpa" | "metaCpa",
) {
  return function CpaBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportMonthlyCpaChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = resolveLabelNumericValue(props.value, props.payload, dataKey);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || n <= 0) {
      return null;
    }
    const text = formatCpaBarLabel(n, currency);
    if (!text) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#374151"
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
      >
        {text}
      </text>
    );
  };
}

type CpaTooltipProps = TooltipProps<number, string> & {
  channelFilter: MonthlySpendChannelFilter;
  googleCurrency: string | null;
  metaCurrency: string | null;
  metaPeriodSpend: number;
  showGoogle: boolean;
  showMeta: boolean;
  combinedScope: ReportCombinedChannelScope;
  mixedCurrency: boolean;
  labels: {
    total: string;
    google: string;
    meta: string;
    mixedHint: string;
    notCalculable: string;
    cpaNotAvailable: string;
    cpaNoSpendThisMonthHint: string;
    periodSpendNote: string;
    spendLabel: string;
    leadsLabel: string;
  };
};

function CpaTooltip({
  active,
  payload,
  label,
  channelFilter,
  googleCurrency,
  metaCurrency,
  metaPeriodSpend,
  showGoogle,
  showMeta,
  combinedScope,
  mixedCurrency,
  labels,
}: CpaTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ReportMonthlyCpaChartPoint | undefined;
  if (!row) return null;

  const renderChannelBlock = (
    cpa: number | null,
    spend: number,
    leads: number,
    channelLabel: string,
    currency: string | null,
    options?: { periodSpend?: number; noSpendHint?: string },
  ) => {
    const cpaLine =
      cpa != null && cpa > 0 && leads > 0 ? (
        <p className="tabular-nums text-gray-900">
          {channelLabel}: {formatCpaValue(cpa, currency)}
        </p>
      ) : (
        <p className="tabular-nums text-gray-900">
          {channelLabel}:{" "}
          <span className="text-muted-foreground">
            {leads > 0 ? labels.cpaNotAvailable : labels.notCalculable}
          </span>
        </p>
      );
    const periodSpend = options?.periodSpend ?? 0;
    return (
      <>
        {cpaLine}
        <p className="mt-0.5 tabular-nums text-muted-foreground">
          {labels.spendLabel}: {formatCpaValue(spend, currency)} · {labels.leadsLabel}: {leads}
        </p>
        {leads > 0 && spend <= 0 && options?.noSpendHint ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {options.noSpendHint}
          </p>
        ) : null}
        {leads > 0 && spend <= 0 && periodSpend > 0 ? (
          <p className="mt-0.5 text-[11px] tabular-nums leading-snug text-muted-foreground">
            {labels.periodSpendNote}: {formatCpaValue(periodSpend, currency)}
          </p>
        ) : null}
      </>
    );
  };

  if (channelFilter === "all") {
    const primaryCurrency =
      googleCurrency && metaCurrency && googleCurrency === metaCurrency
        ? googleCurrency
        : (googleCurrency ?? metaCurrency);
    return (
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-gray-900">{label}</p>
        {renderChannelBlock(
          row.totalCpa,
          row.totalSpend,
          row.totalLeads,
          labels.total,
          primaryCurrency,
        )}
        {showGoogle && combinedScope.includeGoogle && (row.googleSpend > 0 || row.googleLeads > 0) ? (
          <div className="mt-1 border-t border-gray-100 pt-1">
            {renderChannelBlock(
              row.googleCpa,
              row.googleSpend,
              row.googleLeads,
              labels.google,
              googleCurrency,
            )}
          </div>
        ) : null}
        {showMeta && combinedScope.includeMeta && (row.metaSpend > 0 || row.metaLeads > 0) ? (
          <div className="mt-1 border-t border-gray-100 pt-1">
            {renderChannelBlock(
              row.metaCpa,
              row.metaSpend,
              row.metaLeads,
              labels.meta,
              metaCurrency,
              {
                periodSpend: metaPeriodSpend,
                noSpendHint: labels.cpaNoSpendThisMonthHint,
              },
            )}
          </div>
        ) : null}
        {mixedCurrency ? (
          <p className="mt-1 text-[11px] text-amber-700">{labels.mixedHint}</p>
        ) : null}
      </div>
    );
  }

  if (channelFilter === "by_channel") {
    return (
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-gray-900">{label}</p>
        {showGoogle ? (
          <div>
            {renderChannelBlock(
              row.googleCpa,
              row.googleSpend,
              row.googleLeads,
              labels.google,
              googleCurrency,
            )}
          </div>
        ) : null}
        {showMeta ? (
          <div className={showGoogle ? "mt-1 border-t border-gray-100 pt-1" : undefined}>
            {renderChannelBlock(
              row.metaCpa,
              row.metaSpend,
              row.metaLeads,
              labels.meta,
              metaCurrency,
              {
                periodSpend: metaPeriodSpend,
                noSpendHint: labels.cpaNoSpendThisMonthHint,
              },
            )}
          </div>
        ) : null}
        {mixedCurrency ? (
          <p className="mt-1 text-[11px] text-amber-700">{labels.mixedHint}</p>
        ) : null}
      </div>
    );
  }

  const entry = payload[0];
  const name = String(entry?.name ?? "");
  const isGoogle = name === "googleCpa";
  const cpa = isGoogle ? row.googleCpa : row.metaCpa;
  const spend = isGoogle ? row.googleSpend : row.metaSpend;
  const leads = isGoogle ? row.googleLeads : row.metaLeads;
  const currency = isGoogle ? googleCurrency : metaCurrency;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {renderChannelBlock(
        cpa,
        spend,
        leads,
        isGoogle ? labels.google : labels.meta,
        currency,
        isGoogle
          ? undefined
          : {
              periodSpend: metaPeriodSpend,
              noSpendHint: labels.cpaNoSpendThisMonthHint,
            },
      )}
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  channelFilter: MonthlySpendChannelFilter;
  chartData: ReportMonthlyCpaChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  combinedScope: ReportCombinedChannelScope;
  chartLoading: boolean;
  chartDateOverlap: boolean;
  /** When true, render chart body only (no card shell or title). */
  embedded?: boolean;
};

export function DigitalMarketingReportMonthlyCpaChart({
  bootstrapLoading,
  channelFilter,
  chartData,
  googleSeries,
  metaSeries,
  combinedScope,
  chartLoading,
  chartDateOverlap,
  embedded = false,
}: Props) {
  const { t } = useAppTranslation();

  const mixedCurrency =
    googleSeries.connected &&
    metaSeries.connected &&
    googleSeries.currency != null &&
    metaSeries.currency != null &&
    googleSeries.currency !== metaSeries.currency;

  const effectiveChannelFilter =
    channelFilter === "all" && mixedCurrency ? ("by_channel" as const) : channelFilter;

  const showGoogle = isGoogleSeriesChartActive(googleSeries, effectiveChannelFilter);
  const showMeta = isMetaSeriesChartActive(metaSeries, effectiveChannelFilter);
  const metaSkippedNotice =
    isMetaSeriesChartSkipped(metaSeries) && showGoogle
      ? metaSeries.unavailableReason
      : null;
  const blockingError = getMonthlyChartBlockingError(
    effectiveChannelFilter,
    googleSeries,
    metaSeries,
  );
  const showCombined = effectiveChannelFilter === "all";
  const showGrouped = effectiveChannelFilter === "by_channel";
  const mixedCurrencyBlockedCombined = channelFilter === "all" && mixedCurrency;

  const axisCurrency =
    showCombined && !mixedCurrency
      ? (googleSeries.currency ?? metaSeries.currency)
      : effectiveChannelFilter === "google"
        ? googleSeries.currency
        : effectiveChannelFilter === "meta"
          ? metaSeries.currency
          : showGoogle && showMeta && mixedCurrency
            ? null
            : (googleSeries.currency ?? metaSeries.currency);

  const hasData = chartData.some((row) => {
    if (effectiveChannelFilter === "all") return row.totalCpa != null && row.totalCpa > 0;
    if (effectiveChannelFilter === "google") return row.googleCpa != null && row.googleCpa > 0;
    if (effectiveChannelFilter === "meta") return row.metaCpa != null && row.metaCpa > 0;
    return (
      (row.googleCpa != null && row.googleCpa > 0) ||
      (row.metaCpa != null && row.metaCpa > 0)
    );
  });

  const loading = chartLoading;

  const barChartSpacing = useMemo(() => {
    if (showCombined || effectiveChannelFilter === "google" || effectiveChannelFilter === "meta") {
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
  }, [showCombined, showGrouped, effectiveChannelFilter]);

  const tooltipLabels = useMemo(
    () => ({
      total: t("digitalMarketing.report.monthlySpendFilterAll", "All channels"),
      google: t("digitalMarketing.report.channelGoogle", "Google Ads"),
      meta: t("digitalMarketing.report.channelMeta", "Meta Ads"),
      mixedHint: t(
        "digitalMarketing.report.monthlyCpaMixedCurrencyHint",
        "Combined CPA is unavailable when channels use different currencies. Showing per channel.",
      ),
      notCalculable: t(
        "digitalMarketing.report.monthlyCpaNotCalculable",
        "Cannot calculate (no converted leads)",
      ),
      cpaNotAvailable: t(
        "digitalMarketing.report.monthlyCpaNoSpend",
        "CPA not available (no spend this month)",
      ),
      cpaNoSpendThisMonthHint: t(
        "digitalMarketing.report.monthlyCpaNoSpendHint",
        "Leads use conversion month; Meta spend uses the ad delivery month.",
      ),
      periodSpendNote: t(
        "digitalMarketing.report.monthlyCpaPeriodSpendNote",
        "Spend in filtered period (other months)",
      ),
      spendLabel: t("digitalMarketing.report.monthlyCpaTooltipSpend", "Spend"),
      leadsLabel: t("digitalMarketing.report.tableConvertedLeads", "Conv. leads"),
    }),
    [t],
  );

  const chartDataForRender = useMemo(
    () =>
      chartData.map((row) => ({
        ...row,
        totalCpa: row.totalCpa ?? undefined,
        googleCpa: row.googleCpa ?? undefined,
        metaCpa: row.metaCpa ?? undefined,
      })),
    [chartData],
  );

  const shellClass = embedded
    ? "min-w-0"
    : "overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className={shellClass}>
      {!embedded ? (
        <div className="mb-3 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">
            {t("digitalMarketing.report.monthlyCpaTitle", "Monthly CPA trend")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(
              "digitalMarketing.report.monthlyCpaSubtitle",
              "Account-level cost per acquisition by month (spend ÷ converted leads with matching campaign UTM).",
            )}
          </p>
        </div>
      ) : null}

      {loading ? (
        bootstrapLoading ? null : (
          <Skeleton className="h-[300px] w-full rounded-md" />
        )
      ) : !hasMonthlyChartDisplayableChannel(
          effectiveChannelFilter,
          googleSeries,
          metaSeries,
        ) ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {!googleSeries.connected && !metaSeries.connected
            ? t(
                "digitalMarketing.report.monthlyCpaNotConnected",
                "Connect Google Ads or Meta Ads to see monthly CPA.",
              )
            : blockingError}
        </div>
      ) : !chartDateOverlap ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {t(
            "digitalMarketing.report.monthlySpendNoOverlap",
            "The date filter does not overlap the selected chart year. Adjust the date range or chart year.",
          )}
        </div>
      ) : blockingError ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-red-600">
          {blockingError}
        </div>
      ) : !hasData ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t("digitalMarketing.report.monthlyCpaEmpty", "No CPA data for this year.")}
        </div>
      ) : (
        <>
          {metaSkippedNotice ? (
            <p className="mb-2 text-xs text-amber-700">{metaSkippedNotice}</p>
          ) : null}
          <div className="mb-2 flex flex-wrap items-center gap-4">
            {showCombined ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: COMBINED_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.monthlySpendFilterAll", "All channels")}
                {axisCurrency ? ` (${axisCurrency})` : ""}
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
            {effectiveChannelFilter === "google" ? (
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
            {effectiveChannelFilter === "meta" ? (
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
          {mixedCurrencyBlockedCombined ? (
            <p className="mb-2 text-[11px] text-amber-700">{tooltipLabels.mixedHint}</p>
          ) : null}
          <div className="h-[300px] w-full min-w-0 overflow-x-auto">
            <div
              className="h-full"
              style={{ minWidth: Math.max(chartData.length * 48, 560) }}
            >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartDataForRender}
                margin={{ top: 32, right: 12, left: 4, bottom: 4 }}
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
                  tickFormatter={(v) => formatCpaAxisTick(Number(v), axisCurrency)}
                />
                <Tooltip
                  content={
                    <CpaTooltip
                      channelFilter={effectiveChannelFilter}
                      googleCurrency={googleSeries.currency}
                      metaCurrency={metaSeries.currency}
                      metaPeriodSpend={metaSeries.periodSummary?.spend ?? 0}
                      showGoogle={googleSeries.connected}
                      showMeta={metaSeries.connected}
                      combinedScope={combinedScope}
                      mixedCurrency={mixedCurrency}
                      labels={tooltipLabels}
                    />
                  }
                />
                {showCombined ? (
                  <Bar
                    dataKey="totalCpa"
                    fill={COMBINED_BAR}
                    radius={[4, 4, 0, 0]}
                    name="totalCpa"
                    barSize={barChartSpacing.combinedBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createCpaBarLabelRenderer(
                        googleSeries.currency &&
                          metaSeries.currency &&
                          googleSeries.currency === metaSeries.currency
                          ? googleSeries.currency
                          : (googleSeries.currency ?? metaSeries.currency),
                        "totalCpa",
                      )}
                    />
                  </Bar>
                ) : null}
                {showGrouped && showGoogle ? (
                  <Bar
                    dataKey="googleCpa"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleCpa"
                    barSize={showMeta ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createCpaBarLabelRenderer(googleSeries.currency, "googleCpa")}
                    />
                  </Bar>
                ) : null}
                {showGrouped && showMeta ? (
                  <Bar
                    dataKey="metaCpa"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaCpa"
                    barSize={showGoogle ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createCpaBarLabelRenderer(metaSeries.currency, "metaCpa")}
                    />
                  </Bar>
                ) : null}
                {effectiveChannelFilter === "google" ? (
                  <Bar
                    dataKey="googleCpa"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleCpa"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createCpaBarLabelRenderer(googleSeries.currency, "googleCpa")}
                    />
                  </Bar>
                ) : null}
                {effectiveChannelFilter === "meta" ? (
                  <Bar
                    dataKey="metaCpa"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaCpa"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createCpaBarLabelRenderer(metaSeries.currency, "metaCpa")}
                    />
                  </Bar>
                ) : null}
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
