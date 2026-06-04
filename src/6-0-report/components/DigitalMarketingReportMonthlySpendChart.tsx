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
  ReportMonthlySpendChartPoint,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

const GOOGLE_BAR = "hsl(204 70% 42%)";
const META_BAR = "hsl(262 55% 52%)";
/** Combined all-channel total — distinct from Google (blue) and Meta (purple). */
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

function formatSpendBarLabel(
  value: unknown,
  channel: "google" | "meta" | "combined",
  currency: string | null,
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatSpendTooltip(n, channel, currency);
}

function resolveLabelNumericValue(
  raw: number | string | Array<number | string> | undefined,
  payload: ReportMonthlySpendChartPoint | undefined,
  dataKey: keyof ReportMonthlySpendChartPoint,
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
function createSpendBarLabelRenderer(
  currency: string | null,
  channel: "google" | "meta" | "combined",
  dataKey: "totalSpend" | "googleSpend" | "metaSpend",
) {
  return function SpendBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportMonthlySpendChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = resolveLabelNumericValue(props.value, props.payload, dataKey);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || n <= 0) {
      return null;
    }
    const text = formatSpendBarLabel(n, channel, currency);
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

  if (channelFilter === "by_channel") {
    return (
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-gray-900">{label}</p>
        {showGoogle ? (
          <p className="tabular-nums text-gray-900">
            {labels.google}: {formatSpendTooltip(row.googleSpend, "google", googleCurrency)}
          </p>
        ) : null}
        {showMeta ? (
          <p className={`tabular-nums text-gray-900${showGoogle ? " mt-0.5" : ""}`}>
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
  channelFilter: MonthlySpendChannelFilter;
  chartData: ReportMonthlySpendChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  chartLoading: boolean;
  chartDateOverlap: boolean;
  /** When true, render chart body only (no card shell or title). */
  embedded?: boolean;
};

export function DigitalMarketingReportMonthlySpendChart({
  bootstrapLoading,
  channelFilter,
  chartData,
  googleSeries,
  metaSeries,
  chartLoading,
  chartDateOverlap,
  embedded = false,
}: Props) {
  const { t } = useAppTranslation();

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

  const combinedLabelCurrency =
    googleSeries.currency &&
    metaSeries.currency &&
    googleSeries.currency === metaSeries.currency
      ? googleSeries.currency
      : (googleSeries.currency ?? metaSeries.currency);

  const shellClass = embedded
    ? "min-w-0"
    : "overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className={shellClass}>
      {!embedded ? (
        <div className="mb-3 min-w-0">
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
      ) : null}

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
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        combinedLabelCurrency,
                        "combined",
                        "totalSpend",
                      )}
                    />
                  </Bar>
                ) : null}
                {showGrouped && showGoogle ? (
                  <Bar
                    dataKey="googleSpend"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleSpend"
                    barSize={showMeta ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        googleSeries.currency,
                        "google",
                        "googleSpend",
                      )}
                    />
                  </Bar>
                ) : null}
                {showGrouped && showMeta ? (
                  <Bar
                    dataKey="metaSpend"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaSpend"
                    barSize={showGoogle ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        metaSeries.currency,
                        "meta",
                        "metaSpend",
                      )}
                    />
                  </Bar>
                ) : null}
                {channelFilter === "google" ? (
                  <Bar
                    dataKey="googleSpend"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleSpend"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        googleSeries.currency,
                        "google",
                        "googleSpend",
                      )}
                    />
                  </Bar>
                ) : null}
                {channelFilter === "meta" ? (
                  <Bar
                    dataKey="metaSpend"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaSpend"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        metaSeries.currency,
                        "meta",
                        "metaSpend",
                      )}
                    />
                  </Bar>
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
