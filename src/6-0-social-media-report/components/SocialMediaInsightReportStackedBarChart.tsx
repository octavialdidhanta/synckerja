import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SocialMediaInsightMonthlyChartPoint } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import {
  SOCIAL_INSIGHT_CHART_COLORS,
  SOCIAL_INSIGHT_CHART_PLATFORMS,
  type SocialInsightChartPlatform,
} from "@/6-0-social-media-report/socialMediaInsightChartColors";

type GroupedSlotChartPoint = SocialMediaInsightMonthlyChartPoint & {
  [key: `bar${number}`]: number;
  [key: `bar${number}Platform`]: SocialInsightChartPlatform | null;
};

function platformColor(platform: SocialInsightChartPlatform | null): string {
  if (!platform) return "transparent";
  return SOCIAL_INSIGHT_CHART_COLORS[platform];
}

/** Grouped bars per month; smallest value left, each bar height matches the Y-axis scale. */
function toSortedGroupedChartData(
  data: SocialMediaInsightMonthlyChartPoint[],
): GroupedSlotChartPoint[] {
  return data.map((point) => {
    const sorted = SOCIAL_INSIGHT_CHART_PLATFORMS.map((platform) => ({
      platform,
      value: point[platform],
    }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => a.value - b.value);

    const slots: GroupedSlotChartPoint = { ...point, bar0: 0, bar0Platform: null };
    for (let i = 0; i < SOCIAL_INSIGHT_CHART_PLATFORMS.length; i++) {
      slots[`bar${i}`] = sorted[i]?.value ?? 0;
      slots[`bar${i}Platform`] = sorted[i]?.platform ?? null;
    }
    return slots;
  });
}

type Props = {
  data: SocialMediaInsightMonthlyChartPoint[];
  valueSuffix?: string;
  formatValue?: (n: number) => string;
  height?: number;
};

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

function InsightTooltip({
  active,
  label,
  formatValue,
  valueSuffix = "",
  sourcePoint,
  platformLabels,
}: {
  active?: boolean;
  label?: string;
  formatValue: (n: number) => string;
  valueSuffix?: string;
  sourcePoint?: SocialMediaInsightMonthlyChartPoint;
  platformLabels: Record<SocialInsightChartPlatform, string>;
}) {
  if (!active || !sourcePoint) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {SOCIAL_INSIGHT_CHART_PLATFORMS.map((platform) => (
        <p key={platform} style={{ color: SOCIAL_INSIGHT_CHART_COLORS[platform] }}>
          {platformLabels[platform]}: {formatValue(sourcePoint[platform])}
          {valueSuffix}
        </p>
      ))}
    </div>
  );
}

export function SocialMediaInsightReportStackedBarChart({
  data,
  valueSuffix = "",
  formatValue = defaultFormat,
  height = 280,
}: Props) {
  const { t } = useAppTranslation();
  const chartData = useMemo(() => toSortedGroupedChartData(data), [data]);
  const platformLabels: Record<SocialInsightChartPlatform, string> = {
    tiktok: t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok"),
    youtube: t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube"),
    linkedin: t("digitalMarketing.socialMediaPerformance.platformLinkedIn", "LinkedIn"),
    threads: t("digitalMarketing.socialMediaPerformance.platformThreads", "Threads"),
    instagram: t("digitalMarketing.socialMediaPerformance.platformInstagram", "Instagram"),
    facebook: t("digitalMarketing.socialMediaPerformance.platformFacebook", "Facebook"),
  };
  const legendPayload = SOCIAL_INSIGHT_CHART_PLATFORMS.map((platform) => ({
    value: platformLabels[platform],
    type: "square" as const,
    color: SOCIAL_INSIGHT_CHART_COLORS[platform],
    id: platform,
  }));

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.socialMediaInsightReport.chartNoData", "No chart data for this period.")}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 13% 91%)" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatValue(Number(v))}
        />
        <Tooltip
          content={({ active, label }) => {
            const sourcePoint = chartData.find((row) => row.monthLabel === label);
            return (
              <InsightTooltip
                active={active}
                label={label}
                formatValue={formatValue}
                valueSuffix={valueSuffix}
                sourcePoint={sourcePoint}
                platformLabels={platformLabels}
              />
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} payload={legendPayload} />
        {SOCIAL_INSIGHT_CHART_PLATFORMS.map((_, index) => (
          <Bar
            key={`bar-${index}`}
            dataKey={`bar${index}`}
            legendType="none"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {chartData.map((row) => (
              <Cell
                key={`${row.monthKey}-bar${index}`}
                fill={platformColor(row[`bar${index}Platform`])}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
