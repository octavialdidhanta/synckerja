import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useTranslation } from "react-i18next";
import type { YouTubeChannelDailyTrendRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YOUTUBE_ANALYTICS_CHART_COLORS } from "@/6-0-social-media-performance/components/youtube-analytics/youtubeAnalyticsChartColors";

type Props = {
  rows: YouTubeChannelDailyTrendRow[];
  height?: number;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatDateLabel(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{formatDateLabel(String(label ?? ""))}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {formatCount(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export function YouTubeDailyTrendLineChart({ rows, height = 280 }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.youtubeContent.analytics.empty", "No analytics data for this period.")}
      </p>
    );
  }

  const chartData = rows.map((row) => ({
    date: row.date,
    dateLabel: formatDateLabel(row.date),
    views: row.views,
    watchTime: row.estimated_minutes_watched,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={YOUTUBE_ANALYTICS_CHART_COLORS.grid} />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="views"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatCount}
        />
        <YAxis
          yAxisId="watchTime"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatCount}
        />
        <Tooltip content={<TrendTooltip />} />
        <Legend />
        <Line
          yAxisId="views"
          type="monotone"
          dataKey="views"
          name={t("digitalMarketing.youtubeContent.analytics.overview.views", "Views")}
          stroke={YOUTUBE_ANALYTICS_CHART_COLORS.primary}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="watchTime"
          type="monotone"
          dataKey="watchTime"
          name={t("digitalMarketing.youtubeContent.analytics.overview.watchTime", "Watch time (min)")}
          stroke={YOUTUBE_ANALYTICS_CHART_COLORS.secondary}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
