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
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import type { MonthlySpendChannelSeries } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportLeadsByServiceChartPoint } from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
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

function formatLeadsAxisTick(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function formatLeadsCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function truncateAxisLabel(label: string): string {
  if (label.length <= AXIS_LABEL_MAX) return label;
  return `${label.slice(0, AXIS_LABEL_MAX - 1)}…`;
}

function resolveLeadsLabelValue(
  raw: number | string | Array<number | string> | undefined,
  payload: ReportLeadsByServiceChartPoint | undefined,
): number | null {
  if (Array.isArray(raw)) {
    const first = raw[0];
    const n = typeof first === "number" ? first : Number(first);
    if (Number.isFinite(n)) return n;
  } else if (raw != null && raw !== "") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  if (payload && Number.isFinite(payload.leads)) return payload.leads;
  return null;
}

function createServiceLeadsBarLabelRenderer() {
  return function ServiceLeadsBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportLeadsByServiceChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = resolveLeadsLabelValue(props.value, props.payload);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || n <= 0) {
      return null;
    }
    const text = formatLeadsCount(n);
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

type ServiceLeadsTooltipProps = TooltipProps<number, string>;

function ServiceLeadsTooltip({ active, payload }: ServiceLeadsTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ReportLeadsByServiceChartPoint | undefined;
  if (!row || row.leads <= 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-900">{row.serviceLabel}</p>
      <p className="mt-0.5 tabular-nums text-gray-900">{formatLeadsCount(row.leads)}</p>
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  channelFilter: MonthlyChartChannelFilter;
  chartData: ReportLeadsByServiceChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  chartLoading: boolean;
  chartDateOverlap: boolean;
  error: string | null;
  embedded?: boolean;
};

export function DigitalMarketingReportMonthlyLeadsByServiceChart({
  bootstrapLoading,
  channelFilter,
  chartData,
  googleSeries,
  metaSeries,
  chartLoading,
  chartDateOverlap,
  error: serviceFetchError,
  embedded = false,
}: Props) {
  const { t } = useAppTranslation();

  const blockingError =
    serviceFetchError ?? getMonthlyChartBlockingError(channelFilter, googleSeries, metaSeries);
  const metaSkippedNotice =
    isMetaSeriesChartSkipped(metaSeries) && channelFilter !== "google"
      ? metaSeries.unavailableReason
      : null;

  const hasData = chartData.some((row) => row.leads > 0);
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
      ) : !hasMonthlyChartDisplayableChannel(channelFilter, googleSeries, metaSeries) ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 px-4 text-center text-sm text-muted-foreground">
          {!googleSeries.connected && !metaSeries.connected
            ? t(
                "digitalMarketing.report.monthlyLeadsNotConnected",
                "Connect Google Ads or Meta Ads to see converted leads.",
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
            "digitalMarketing.report.monthlyLeadsByServiceEmptyServices",
            "No services with converted leads in the selected range.",
          )}
        </div>
      ) : !hasData ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t("digitalMarketing.report.monthlyLeadsEmpty", "No converted leads for this year.")}
        </div>
      ) : (
        <>
          {metaSkippedNotice ? (
            <p className="mb-2 text-xs text-amber-700">{metaSkippedNotice}</p>
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
                    width={40}
                    allowDecimals={false}
                    tickFormatter={(v) => formatLeadsAxisTick(Number(v))}
                  />
                  <Tooltip content={<ServiceLeadsTooltip />} />
                  <Bar
                    dataKey="leads"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={barLayout.maxBarSize}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.dataKey} fill={entry.color} />
                    ))}
                    <LabelList position="top" content={createServiceLeadsBarLabelRenderer()} />
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
