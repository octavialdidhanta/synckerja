import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import type { MonthlySpendChannelSeries } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportCpaByServiceChartPoint } from "@/6-0-digital-marketing-shared/reportMonthlyCpaByService";
import {
  getMonthlyChartBlockingError,
  hasMonthlyChartDisplayableChannel,
  isMetaSeriesChartSkipped,
} from "@/6-0-digital-marketing-shared/monthlyReportChartDisplay";

const AXIS_LABEL_MAX = 14;

const WIDE_SERVICE_BAR_LAYOUT = {
  barCategoryGap: "1%" as const,
  barGap: 0,
  maxBarSize: 160,
};

const SCROLLABLE_SERVICE_BAR_LAYOUT = {
  barCategoryGap: "10%" as const,
  barGap: 0,
  maxBarSize: 96,
  minWidthPerBar: 88,
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

function truncateAxisLabel(label: string): string {
  if (label.length <= AXIS_LABEL_MAX) return label;
  return `${label.slice(0, AXIS_LABEL_MAX - 1)}…`;
}

function resolveCpaLabelValue(
  raw: number | string | Array<number | string> | undefined,
  payload: ReportCpaByServiceChartPoint | undefined,
): number | null {
  if (Array.isArray(raw)) {
    const first = raw[0];
    const n = typeof first === "number" ? first : Number(first);
    if (Number.isFinite(n)) return n;
  } else if (raw != null && raw !== "") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  if (payload && Number.isFinite(payload.cpa)) return payload.cpa;
  return null;
}

function createServiceCpaBarLabelRenderer(currency: string | null) {
  return function ServiceCpaBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportCpaByServiceChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = resolveCpaLabelValue(props.value, props.payload);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || n <= 0) {
      return null;
    }
    const text = formatCpaValue(n, currency);
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

type ServiceCpaTooltipProps = TooltipProps<number, string> & {
  currency: string | null;
};

function ServiceCpaTooltip({ active, payload, currency }: ServiceCpaTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ReportCpaByServiceChartPoint | undefined;
  if (!row || row.cpa <= 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-900">{row.serviceLabel}</p>
      <p className="mt-0.5 tabular-nums text-gray-900">CPA: {formatCpaValue(row.cpa, currency)}</p>
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  channelFilter: MonthlyChartChannelFilter;
  chartData: ReportCpaByServiceChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  tiktokSeries: MonthlySpendChannelSeries;
  chartLoading: boolean;
  chartDateOverlap: boolean;
  currency: string | null;
  error: string | null;
  embedded?: boolean;
};

export function DigitalMarketingReportMonthlyCpaByServiceChart({
  bootstrapLoading,
  channelFilter,
  chartData,
  googleSeries,
  metaSeries,
  tiktokSeries,
  chartLoading,
  chartDateOverlap,
  currency,
  error: serviceFetchError,
  embedded = false,
}: Props) {
  const { t } = useAppTranslation();

  const blockingError =
    serviceFetchError ?? getMonthlyChartBlockingError(channelFilter, googleSeries, metaSeries, tiktokSeries);
  const metaSkippedNotice =
    isMetaSeriesChartSkipped(metaSeries) && channelFilter !== "google" && channelFilter !== "tiktok"
      ? metaSeries.unavailableReason
      : null;

  const hasData = chartData.some((row) => row.cpa > 0);
  const loading = chartLoading;

  const barLayout = useMemo(() => {
    if (chartData.length <= 8) {
      return { ...WIDE_SERVICE_BAR_LAYOUT, useScroll: false as const };
    }
    return {
      ...SCROLLABLE_SERVICE_BAR_LAYOUT,
      useScroll: true as const,
      minWidth: Math.max(
        chartData.length * SCROLLABLE_SERVICE_BAR_LAYOUT.minWidthPerBar,
        560,
      ),
    };
  }, [chartData.length]);

  const shellClass = embedded
    ? "min-w-0"
    : "overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className={shellClass}>
      {loading ? (
        bootstrapLoading ? null : (
          <Skeleton className="h-[300px] w-full rounded-md" />
        )
      ) : !hasMonthlyChartDisplayableChannel(channelFilter, googleSeries, metaSeries, tiktokSeries) ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {!googleSeries.connected && !metaSeries.connected && !tiktokSeries.connected
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
      ) : chartData.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t(
            "digitalMarketing.report.monthlyCpaByServiceEmptyServices",
            "No services with calculable CPA in the selected range.",
          )}
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
          {currency ? (
            <p className="mb-2 text-xs text-muted-foreground">{currency}</p>
          ) : null}
          <div
            className={`h-[300px] w-full min-w-0${barLayout.useScroll ? " overflow-x-auto" : ""}`}
          >
            <div
              className="h-full w-full"
              style={barLayout.useScroll ? { minWidth: barLayout.minWidth } : undefined}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 32, right: 12, left: 4, bottom: 28 }}
                  barCategoryGap={barLayout.barCategoryGap}
                  barGap={barLayout.barGap}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="serviceLabel"
                    fontSize={11}
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickFormatter={truncateAxisLabel}
                  />
                  <YAxis
                    fontSize={10}
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => formatCpaAxisTick(Number(v), currency)}
                  />
                  <Tooltip content={<ServiceCpaTooltip currency={currency} />} />
                  <Bar
                    dataKey="cpa"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={barLayout.maxBarSize}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.dataKey} fill={entry.color} />
                    ))}
                    <LabelList
                      position="top"
                      content={createServiceCpaBarLabelRenderer(currency)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
