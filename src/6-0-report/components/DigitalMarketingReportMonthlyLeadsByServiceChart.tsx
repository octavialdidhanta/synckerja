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
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import type { MonthlySpendChannelSeries } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportLeadsByServiceChartPoint } from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
import {
  getMonthlyChartBlockingError,
  hasMonthlyChartDisplayableChannel,
  isMetaSeriesChartSkipped,
} from "@/6-0-digital-marketing-shared/monthlyReportChartDisplay";

const PRODUCT_BAR = "hsl(160 52% 36%)";
const SERVICE_BAR = "hsl(262 55% 52%)";

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

function readLabelNumber(
  value: number | string | Array<number | string> | undefined,
  payload: ReportLeadsByServiceChartPoint | undefined,
  dataKey: "productPurchases" | "leads",
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const fromValue = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(fromValue)) return fromValue;
  const fromRow = payload?.[dataKey];
  return typeof fromRow === "number" && Number.isFinite(fromRow) ? fromRow : null;
}

function createCountBarLabelRenderer(dataKey: "productPurchases" | "leads") {
  return function CountBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportLeadsByServiceChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = readLabelNumber(props.value, props.payload, dataKey);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || !(n > 0)) {
      return null;
    }
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#374151"
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
      >
        {formatLeadsCount(n)}
      </text>
    );
  };
}

type ServiceLeadsTooltipProps = TooltipProps<number, string> & {
  productsLabel: string;
  servicesLabel: string;
  purchaseValueLabel: string;
  currency: string | null;
};

function ServiceLeadsTooltip({
  active,
  payload,
  productsLabel,
  servicesLabel,
  purchaseValueLabel,
  currency,
}: ServiceLeadsTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ReportLeadsByServiceChartPoint | undefined;
  if (!row) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-900">{row.serviceLabel}</p>
      <p className="mt-1 tabular-nums text-gray-900">
        {productsLabel}: {formatLeadsCount(row.productPurchases)}
      </p>
      <p className="tabular-nums text-gray-600">
        {purchaseValueLabel}: {formatMetaMetricValue("spend", row.productPurchaseValue, currency)}
      </p>
      <p className="mt-1 tabular-nums text-gray-900">
        {servicesLabel}: {formatLeadsCount(row.leads)}
      </p>
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  channelFilter: MonthlyChartChannelFilter;
  chartData: ReportLeadsByServiceChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  tiktokSeries: MonthlySpendChannelSeries;
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
  tiktokSeries,
  chartLoading,
  chartDateOverlap,
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

  const maxCount = chartData.reduce(
    (max, row) => Math.max(max, row.productPurchases, row.leads),
    0,
  );
  const showProducts = chartData.some((row) => row.productPurchases > 0);
  const showServices = chartData.some((row) => row.leads > 0);
  const productsLabel = t("digitalMarketing.report.convertedProducts", "Products");
  const servicesLabel = t("digitalMarketing.report.convertedServices", "Services");
  const purchaseValueLabel = t("digitalMarketing.report.purchaseValue", "Purchase value");
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
            "No products or services in the selected range.",
          )}
        </div>
      ) : (
        <>
          {metaSkippedNotice ? (
            <p className="mb-2 text-xs text-amber-700">{metaSkippedNotice}</p>
          ) : null}
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            {showProducts ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRODUCT_BAR }} aria-hidden />
                {productsLabel}
              </span>
            ) : null}
            {showServices ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERVICE_BAR }} aria-hidden />
                {servicesLabel}
              </span>
            ) : null}
          </div>
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
                    domain={maxCount > 0 ? [0, "auto"] : [0, 1]}
                    ticks={maxCount > 0 ? undefined : [0]}
                    tickFormatter={(v) => formatLeadsAxisTick(Number(v))}
                  />
                  <Tooltip
                    content={
                      <ServiceLeadsTooltip
                        productsLabel={productsLabel}
                        servicesLabel={servicesLabel}
                        purchaseValueLabel={purchaseValueLabel}
                        currency={metaSeries.currency}
                      />
                    }
                  />
                  {showProducts ? (
                    <Bar
                      dataKey="productPurchases"
                      name={productsLabel}
                      fill={PRODUCT_BAR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={barLayout.maxBarSize}
                      isAnimationActive={false}
                    >
                      <LabelList position="top" content={createCountBarLabelRenderer("productPurchases")} />
                    </Bar>
                  ) : null}
                  {showServices ? (
                    <Bar
                      dataKey="leads"
                      name={servicesLabel}
                      fill={SERVICE_BAR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={barLayout.maxBarSize}
                      isAnimationActive={false}
                    >
                      <LabelList position="top" content={createCountBarLabelRenderer("leads")} />
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
