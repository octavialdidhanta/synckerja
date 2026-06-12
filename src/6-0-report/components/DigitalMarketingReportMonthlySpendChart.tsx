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
import {
  getMonthlyChartBlockingError,
  hasMonthlyChartDisplayableChannel,
  isGoogleSeriesChartActive,
  isMetaSeriesChartActive,
  isMetaSeriesChartSkipped,
  isTikTokSeriesChartActive,
  isTikTokSeriesChartSkipped,
} from "@/6-0-digital-marketing-shared/monthlyReportChartDisplay";

const GOOGLE_BAR = "hsl(204 70% 42%)";
const META_BAR = "hsl(262 55% 52%)";
const TIKTOK_BAR = "hsl(350 80% 50%)";
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
  channel: "google" | "meta" | "tiktok" | "combined",
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
  channel: "google" | "meta" | "tiktok" | "combined",
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
  channel: "google" | "meta" | "tiktok" | "combined",
  dataKey: "totalSpend" | "googleSpend" | "metaSpend" | "tiktokSpend",
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
  tiktokCurrency: string | null;
  showGoogle: boolean;
  showMeta: boolean;
  showTikTok: boolean;
  labels: {
    total: string;
    google: string;
    meta: string;
    tiktok: string;
  };
};

function SpendTooltip({
  active,
  payload,
  label,
  channelFilter,
  googleCurrency,
  metaCurrency,
  tiktokCurrency,
  showGoogle,
  showMeta,
  showTikTok,
  labels,
}: SpendTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ReportMonthlySpendChartPoint | undefined;
  if (!row) return null;

  if (channelFilter === "all") {
    const primaryCurrency =
      [googleCurrency, metaCurrency, tiktokCurrency].filter(Boolean).length > 0 &&
      new Set([googleCurrency, metaCurrency, tiktokCurrency].filter(Boolean)).size === 1
        ? (googleCurrency ?? metaCurrency ?? tiktokCurrency)
        : (googleCurrency ?? metaCurrency ?? tiktokCurrency);
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
        {showTikTok && row.tiktokSpend > 0 ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            {labels.tiktok}: {formatSpendTooltip(row.tiktokSpend, "tiktok", tiktokCurrency)}
          </p>
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
        {showTikTok ? (
          <p
            className={`tabular-nums text-gray-900${showGoogle || showMeta ? " mt-0.5" : ""}`}
          >
            {labels.tiktok}: {formatSpendTooltip(row.tiktokSpend, "tiktok", tiktokCurrency)}
          </p>
        ) : null}
      </div>
    );
  }

  const entry = payload[0];
  const value = Number(entry?.value ?? 0);
  const name = String(entry?.name ?? "");
  const isGoogle = name === "googleSpend";
  const isMeta = name === "metaSpend";
  const channel: "google" | "meta" | "tiktok" = isGoogle ? "google" : isMeta ? "meta" : "tiktok";
  const labelText = isGoogle ? labels.google : isMeta ? labels.meta : labels.tiktok;
  const currency = isGoogle ? googleCurrency : isMeta ? metaCurrency : tiktokCurrency;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      <p className="tabular-nums text-gray-900">
        {labelText}: {formatSpendTooltip(value, channel, currency)}
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
  tiktokSeries: MonthlySpendChannelSeries;
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
  tiktokSeries,
  chartLoading,
  chartDateOverlap,
  embedded = false,
}: Props) {
  const { t } = useAppTranslation();

  const showGoogle = isGoogleSeriesChartActive(googleSeries, channelFilter);
  const showMeta = isMetaSeriesChartActive(metaSeries, channelFilter);
  const showTikTok = isTikTokSeriesChartActive(tiktokSeries, channelFilter);
  const metaSkippedNotice =
    isMetaSeriesChartSkipped(metaSeries) && (showGoogle || showTikTok)
      ? metaSeries.unavailableReason
      : null;
  const tiktokSkippedNotice =
    isTikTokSeriesChartSkipped(tiktokSeries) && (showGoogle || showMeta)
      ? tiktokSeries.unavailableReason
      : null;
  const blockingError = getMonthlyChartBlockingError(
    channelFilter,
    googleSeries,
    metaSeries,
    tiktokSeries,
  );
  const showCombined = channelFilter === "all";
  const showGrouped = channelFilter === "by_channel";

  const mixedCurrency =
    [googleSeries, metaSeries, tiktokSeries].filter((s) => s.connected && s.currency != null)
      .map((s) => s.currency!)
      .filter((c, i, arr) => arr.indexOf(c) === i).length > 1;

  const axisCurrency =
    showCombined && !mixedCurrency
      ? (googleSeries.currency ?? metaSeries.currency ?? tiktokSeries.currency)
      : channelFilter === "google"
        ? googleSeries.currency
        : channelFilter === "meta"
          ? metaSeries.currency
          : channelFilter === "tiktok"
            ? tiktokSeries.currency
          : showGoogle && showMeta && showTikTok && mixedCurrency
            ? null
            : (googleSeries.currency ?? metaSeries.currency ?? tiktokSeries.currency);

  const hasData = chartData.some((row) => {
    if (channelFilter === "all") return row.totalSpend > 0;
    if (channelFilter === "google") return row.googleSpend > 0;
    if (channelFilter === "meta") return row.metaSpend > 0;
    if (channelFilter === "tiktok") return row.tiktokSpend > 0;
    return row.googleSpend > 0 || row.metaSpend > 0 || row.tiktokSpend > 0;
  });

  const loading = chartLoading;

  const barChartSpacing = useMemo(() => {
    if (
      showCombined ||
      channelFilter === "google" ||
      channelFilter === "meta" ||
      channelFilter === "tiktok"
    ) {
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
      tiktok: t("digitalMarketing.report.channelTikTok", "TikTok Ads"),
    }),
    [t],
  );

  const combinedLabelCurrency = (() => {
    const codes = [googleSeries.currency, metaSeries.currency, tiktokSeries.currency].filter(
      Boolean,
    );
    return codes.length > 0 && new Set(codes).size === 1
      ? codes[0]!
      : (googleSeries.currency ?? metaSeries.currency ?? tiktokSeries.currency);
  })();

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
        bootstrapLoading ? null : (
          <Skeleton className="h-[300px] w-full rounded-md" />
        )
      ) : !hasMonthlyChartDisplayableChannel(
          channelFilter,
          googleSeries,
          metaSeries,
          tiktokSeries,
        ) ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {!googleSeries.connected && !metaSeries.connected && !tiktokSeries.connected
            ? t(
                "digitalMarketing.report.monthlySpendNotConnected",
                "Connect Google Ads, Meta Ads, or TikTok Ads to see monthly spend.",
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
          {t("digitalMarketing.report.monthlySpendEmpty", "No spend data for this year.")}
        </div>
      ) : (
        <>
          {metaSkippedNotice ? (
            <p className="mb-2 text-xs text-amber-700">{metaSkippedNotice}</p>
          ) : null}
          {tiktokSkippedNotice ? (
            <p className="mb-2 text-xs text-amber-700">{tiktokSkippedNotice}</p>
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
            {showGrouped && showTikTok ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: TIKTOK_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelTikTok", "TikTok Ads")}
                {tiktokSeries.currency ? ` (${tiktokSeries.currency})` : ""}
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
            {channelFilter === "tiktok" ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: TIKTOK_BAR }}
                  aria-hidden
                />
                {t("digitalMarketing.report.channelTikTok", "TikTok Ads")}
                {tiktokSeries.currency ? ` (${tiktokSeries.currency})` : ""}
              </span>
            ) : null}
          </div>
          <div className="h-[300px] w-full min-w-0 overflow-x-auto">
            <div
              className="h-full"
              style={{ minWidth: Math.max(chartData.length * 48, 560) }}
            >
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
                      tiktokCurrency={tiktokSeries.currency}
                      showGoogle={showGoogle}
                      showMeta={showMeta}
                      showTikTok={showTikTok}
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
                    barSize={
                      showMeta || showTikTok
                        ? barChartSpacing.groupedBarSize
                        : barChartSpacing.singleBarSize
                    }
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
                    barSize={
                      showGoogle || showTikTok
                        ? barChartSpacing.groupedBarSize
                        : barChartSpacing.singleBarSize
                    }
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
                {showGrouped && showTikTok ? (
                  <Bar
                    dataKey="tiktokSpend"
                    fill={TIKTOK_BAR}
                    radius={[4, 4, 0, 0]}
                    name="tiktokSpend"
                    barSize={
                      showGoogle || showMeta
                        ? barChartSpacing.groupedBarSize
                        : barChartSpacing.singleBarSize
                    }
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        tiktokSeries.currency,
                        "tiktok",
                        "tiktokSpend",
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
                {channelFilter === "tiktok" ? (
                  <Bar
                    dataKey="tiktokSpend"
                    fill={TIKTOK_BAR}
                    radius={[4, 4, 0, 0]}
                    name="tiktokSpend"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="top"
                      content={createSpendBarLabelRenderer(
                        tiktokSeries.currency,
                        "tiktok",
                        "tiktokSpend",
                      )}
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
