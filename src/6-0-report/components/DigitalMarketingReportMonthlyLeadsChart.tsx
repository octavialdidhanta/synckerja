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
import type {
  MonthlySpendChannelFilter,
  MonthlySpendChannelSeries,
  ReportMonthlyLeadsChartPoint,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportCombinedChannelScope } from "@/6-0-digital-marketing-shared/reportServiceFilter";

const GOOGLE_BAR = "hsl(204 70% 42%)";
const META_BAR = "hsl(262 55% 52%)";
const COMBINED_BAR = "hsl(24 75% 48%)";

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

function formatLeadsAxisTick(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function formatLeadsCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function resolveLabelNumericValue(
  raw: number | string | Array<number | string> | undefined,
  payload: ReportMonthlyLeadsChartPoint | undefined,
  dataKey: keyof ReportMonthlyLeadsChartPoint,
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

function createLeadsBarLabelRenderer(dataKey: "totalLeads" | "googleLeads" | "metaLeads") {
  return function LeadsBarLabelContent(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string | Array<number | string>;
    payload?: ReportMonthlyLeadsChartPoint;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const n = resolveLabelNumericValue(props.value, props.payload, dataKey);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || n == null || n <= 0) {
      return null;
    }
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#374151"
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
      >
        {formatLeadsCount(n)}
      </text>
    );
  };
}

type LeadsTooltipProps = TooltipProps<number, string> & {
  channelFilter: MonthlySpendChannelFilter;
  showGoogle: boolean;
  showMeta: boolean;
  combinedScope: ReportCombinedChannelScope;
  labels: {
    total: string;
    google: string;
    meta: string;
    combinedSumHint: string;
  };
};

function LeadsTooltip({
  active,
  payload,
  label,
  channelFilter,
  showGoogle,
  showMeta,
  combinedScope,
  labels,
}: LeadsTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ReportMonthlyLeadsChartPoint | undefined;
  if (!row) return null;

  if (channelFilter === "all") {
    return (
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-gray-900">{label}</p>
        <p className="tabular-nums text-gray-900">
          {labels.total}: {formatLeadsCount(row.totalLeads)}
        </p>
        {showGoogle && combinedScope.includeGoogle && row.googleLeads > 0 ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            {labels.google}: {formatLeadsCount(row.googleLeads)}
          </p>
        ) : null}
        {showMeta && combinedScope.includeMeta && row.metaLeads > 0 ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            {labels.meta}: {formatLeadsCount(row.metaLeads)}
          </p>
        ) : null}
        {combinedScope.includeGoogle &&
        combinedScope.includeMeta &&
        row.googleLeads > 0 &&
        row.metaLeads > 0 ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {labels.combinedSumHint}
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
            {labels.google}: {formatLeadsCount(row.googleLeads)}
          </p>
        ) : null}
        {showMeta ? (
          <p className={`tabular-nums text-gray-900${showGoogle ? " mt-0.5" : ""}`}>
            {labels.meta}: {formatLeadsCount(row.metaLeads)}
          </p>
        ) : null}
      </div>
    );
  }

  const entry = payload[0];
  const value = Number(entry?.value ?? 0);
  const name = String(entry?.name ?? "");
  const isGoogle = name === "googleLeads";
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      <p className="tabular-nums text-gray-900">
        {isGoogle ? labels.google : labels.meta}: {formatLeadsCount(value)}
      </p>
    </div>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  channelFilter: MonthlySpendChannelFilter;
  chartData: ReportMonthlyLeadsChartPoint[];
  googleSeries: MonthlySpendChannelSeries;
  metaSeries: MonthlySpendChannelSeries;
  combinedScope: ReportCombinedChannelScope;
  chartLoading: boolean;
  chartDateOverlap: boolean;
  embedded?: boolean;
};

export function DigitalMarketingReportMonthlyLeadsChart({
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

  const showGoogle = googleSeries.connected && channelFilter !== "meta";
  const showMeta = metaSeries.connected && channelFilter !== "google";
  const showCombined = channelFilter === "all";
  const showGrouped = channelFilter === "by_channel";

  const hasData = chartData.some((row) => {
    if (channelFilter === "all") return row.totalLeads > 0;
    if (channelFilter === "google") return row.googleLeads > 0;
    if (channelFilter === "meta") return row.metaLeads > 0;
    return row.googleLeads > 0 || row.metaLeads > 0;
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
      combinedSumHint: t(
        "digitalMarketing.report.monthlyLeadsCombinedSumHint",
        "All channels sums leads from channels shown in the table for the selected service.",
      ),
    }),
    [t],
  );

  const shellClass = embedded
    ? "min-w-0"
    : "overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className={shellClass}>
      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-md" />
      ) : !googleSeries.connected && !metaSeries.connected ? (
        <div className="flex h-[300px] items-center justify-center rounded-md bg-gray-50 text-sm text-muted-foreground">
          {t(
            "digitalMarketing.report.monthlyLeadsNotConnected",
            "Connect Google Ads or Meta Ads to see converted leads by month.",
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
          {t("digitalMarketing.report.monthlyLeadsEmpty", "No converted leads for this year.")}
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
              </span>
            ) : null}
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 12, left: 4, bottom: 4 }}
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
                  width={40}
                  allowDecimals={false}
                  tickFormatter={(v) => formatLeadsAxisTick(Number(v))}
                />
                <Tooltip
                  content={
                    <LeadsTooltip
                      channelFilter={channelFilter}
                      showGoogle={googleSeries.connected}
                      showMeta={metaSeries.connected}
                      combinedScope={combinedScope}
                      labels={tooltipLabels}
                    />
                  }
                />
                {showCombined ? (
                  <Bar
                    dataKey="totalLeads"
                    fill={COMBINED_BAR}
                    radius={[4, 4, 0, 0]}
                    name="totalLeads"
                    barSize={barChartSpacing.combinedBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList content={createLeadsBarLabelRenderer("totalLeads")} />
                  </Bar>
                ) : null}
                {showGrouped && showGoogle ? (
                  <Bar
                    dataKey="googleLeads"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleLeads"
                    barSize={showMeta ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList content={createLeadsBarLabelRenderer("googleLeads")} />
                  </Bar>
                ) : null}
                {showGrouped && showMeta ? (
                  <Bar
                    dataKey="metaLeads"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaLeads"
                    barSize={showGoogle ? barChartSpacing.groupedBarSize : barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList content={createLeadsBarLabelRenderer("metaLeads")} />
                  </Bar>
                ) : null}
                {channelFilter === "google" ? (
                  <Bar
                    dataKey="googleLeads"
                    fill={GOOGLE_BAR}
                    radius={[4, 4, 0, 0]}
                    name="googleLeads"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList content={createLeadsBarLabelRenderer("googleLeads")} />
                  </Bar>
                ) : null}
                {channelFilter === "meta" ? (
                  <Bar
                    dataKey="metaLeads"
                    fill={META_BAR}
                    radius={[4, 4, 0, 0]}
                    name="metaLeads"
                    barSize={barChartSpacing.singleBarSize}
                    isAnimationActive={false}
                  >
                    <LabelList content={createLeadsBarLabelRenderer("metaLeads")} />
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
