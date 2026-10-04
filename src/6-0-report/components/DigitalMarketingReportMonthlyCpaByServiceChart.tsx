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
  return formatMetricValue("spent", value, currency ?? "IDR", "micros");
}

function truncateAxisLabel(label: string): string {
  if (label.length <= AXIS_LABEL_MAX) return label;
  return `${label.slice(0, AXIS_LABEL_MAX - 1)}…`;
}

function readCpaLabelNumber(
  value: number | string | Array<number | string> | undefined,
  payload: ReportCpaByServiceChartPoint | undefined,
  dataKey: "productCpa" | "serviceCpa",
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const fromValue = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(fromValue)) return fromValue;
  const fromRow = payload?.[dataKey];
  return typeof fromRow === "number" && Number.isFinite(fromRow) ? fromRow : null;
}

function createServiceCpaBarLabelRenderer(
  currency: string | null,
  dataKey: "productCpa" | "serviceCpa",
) {
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
    const n = readCpaLabelNumber(props.value, props.payload, dataKey);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || !(n > 0)) {
      return null;
    }
    const text = formatCpaValue(n, currency);
    if (!text) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#374151"
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
      >
        {text}
      </text>
    );
  };
}

type ServiceCpaTooltipProps = TooltipProps<number, string> & {
  currency: string | null;
  productsLabel: string;
  servicesLabel: string;
};

function ServiceCpaTooltip({
  active,
  payload,
  currency,
  productsLabel,
  servicesLabel,
}: ServiceCpaTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ReportCpaByServiceChartPoint | undefined;
  if (!row || (row.productCpa <= 0 && row.serviceCpa <= 0)) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-900">{row.serviceLabel}</p>
      {row.productCpa > 0 ? (
        <p className="mt-1 tabular-nums text-gray-900">
          {productsLabel}: {formatCpaValue(row.productCpa, currency)}
        </p>
      ) : null}
      {row.serviceCpa > 0 ? (
        <p className="mt-1 tabular-nums text-gray-900">
          {servicesLabel}: {formatCpaValue(row.serviceCpa, currency)}
        </p>
      ) : null}
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

  const hasData = chartData.some((row) => row.productCpa > 0 || row.serviceCpa > 0);
  const showProducts = chartData.some((row) => row.productCpa > 0);
  const showServices = chartData.some((row) => row.serviceCpa > 0);
  const productsLabel = t("digitalMarketing.report.convertedProducts", "Products");
  const servicesLabel = t("digitalMarketing.report.convertedServices", "Services");
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
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            {showProducts ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(160 52% 36%)" }} aria-hidden />
                {productsLabel}
              </span>
            ) : null}
            {showServices ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(262 55% 52%)" }} aria-hidden />
                {servicesLabel}
              </span>
            ) : null}
          </div>
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
                  <Tooltip
                    content={
                      <ServiceCpaTooltip
                        currency={currency}
                        productsLabel={productsLabel}
                        servicesLabel={servicesLabel}
                      />
                    }
                  />
                  {showProducts ? (
                    <Bar
                      dataKey="productCpa"
                      name={productsLabel}
                      fill="hsl(160 52% 36%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={barLayout.maxBarSize}
                      isAnimationActive={false}
                    >
                      <LabelList position="top" content={createServiceCpaBarLabelRenderer(currency, "productCpa")} />
                    </Bar>
                  ) : null}
                  {showServices ? (
                    <Bar
                      dataKey="serviceCpa"
                      name={servicesLabel}
                      fill="hsl(262 55% 52%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={barLayout.maxBarSize}
                      isAnimationActive={false}
                    >
                      <LabelList position="top" content={createServiceCpaBarLabelRenderer(currency, "serviceCpa")} />
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
