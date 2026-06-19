import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useTranslation } from "react-i18next";
import type { YouTubeChannelDemographicsRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YOUTUBE_ANALYTICS_CHART_COLORS } from "@/6-0-social-media-performance/components/youtube-analytics/youtubeAnalyticsChartColors";

type Props = {
  rows: YouTubeChannelDemographicsRow[];
  height?: number;
};

function genderColor(gender: string): string {
  const g = gender.toLowerCase();
  if (g === "female") return YOUTUBE_ANALYTICS_CHART_COLORS.female;
  if (g === "male") return YOUTUBE_ANALYTICS_CHART_COLORS.male;
  return YOUTUBE_ANALYTICS_CHART_COLORS.userSpecified;
}

function genderLabel(gender: string, t: (key: string, fallback?: string) => string): string {
  const g = gender.toLowerCase();
  if (g === "female") return t("digitalMarketing.youtubeContent.analytics.gender.female", "Female");
  if (g === "male") return t("digitalMarketing.youtubeContent.analytics.gender.male", "Male");
  return t("digitalMarketing.youtubeContent.analytics.gender.other", "Other");
}

function ageLabel(ageGroup: string, t: (key: string, fallback?: string) => string): string {
  const key = `digitalMarketing.youtubeContent.analytics.ageGroup.${ageGroup}`;
  const fallback = ageGroup.replace(/age/i, "").trim() || ageGroup;
  return t(key, fallback);
}

function DemographicsTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value ?? 0).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export function YouTubeDemographicsBarChart({ rows, height = 280 }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.youtubeContent.analytics.empty", "No analytics data for this period.")}
      </p>
    );
  }

  const ageGroups = [...new Set(rows.map((r) => r.age_group))];
  const genders = [...new Set(rows.map((r) => r.gender))];

  const chartData = ageGroups.map((age) => {
    const entry: Record<string, string | number> = {
      ageLabel: ageLabel(age, t),
    };
    for (const gender of genders) {
      const match = rows.find((r) => r.age_group === age && r.gender === gender);
      entry[gender] = match?.viewer_percentage ?? 0;
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={YOUTUBE_ANALYTICS_CHART_COLORS.grid} />
        <XAxis dataKey="ageLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<DemographicsTooltip />} />
        <Legend formatter={(value) => genderLabel(String(value), t)} />
        {genders.map((gender) => (
          <Bar key={gender} dataKey={gender} name={gender} fill={genderColor(gender)} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
