import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

import { SOCIAL_INSIGHT_CHART_COLORS } from "@/6-0-social-media-report/socialMediaInsightChartColors";

type Props = {
  data: { platform: "tiktok" | "youtube" | "linkedin"; views: number }[];
  height?: number;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function PlatformTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      <p>{formatCount(Number(payload[0]?.value ?? 0))} views</p>
    </div>
  );
}

export function SocialMediaInsightReportPlatformBarChart({ data, height = 280 }: Props) {
  const { t } = useAppTranslation();

  const chartData = [...data]
    .sort((a, b) => a.views - b.views)
    .map((d) => ({
      ...d,
      label:
        d.platform === "tiktok"
          ? t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok")
          : d.platform === "youtube"
            ? t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube")
            : t("digitalMarketing.socialMediaPerformance.platformLinkedIn", "LinkedIn"),
    }));

  const total = chartData.reduce((s, d) => s + d.views, 0);
  if (total === 0) {
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
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCount(Number(v))}
        />
        <Tooltip content={<PlatformTooltip />} />
        <Bar dataKey="views" radius={[4, 4, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.platform} fill={SOCIAL_INSIGHT_CHART_COLORS[entry.platform]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
