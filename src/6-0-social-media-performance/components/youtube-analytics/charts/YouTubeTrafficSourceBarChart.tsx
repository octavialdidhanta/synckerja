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
import { useTranslation } from "react-i18next";
import type { YouTubeChannelTrafficSourceRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YOUTUBE_ANALYTICS_CHART_COLORS } from "@/6-0-social-media-performance/components/youtube-analytics/youtubeAnalyticsChartColors";

type Props = {
  rows: YouTubeChannelTrafficSourceRow[];
  height?: number;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function TrafficTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const views = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-900">{payload[0]?.payload?.label}</p>
      <p>{formatCount(views)} views</p>
    </div>
  );
}

export function YouTubeTrafficSourceBarChart({ rows, height = Math.max(280, rows.length * 36) }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.youtubeContent.analytics.empty", "No analytics data for this period.")}
      </p>
    );
  }

  const chartData = rows.slice(0, 12).map((row) => ({
    label: t(
      `digitalMarketing.youtubeContent.analytics.traffic.source.${row.source_label}`,
      row.source_type,
    ),
    views: row.views,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={YOUTUBE_ANALYTICS_CHART_COLORS.grid} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatCount} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<TrafficTooltip />} />
        <Bar dataKey="views" fill={YOUTUBE_ANALYTICS_CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
