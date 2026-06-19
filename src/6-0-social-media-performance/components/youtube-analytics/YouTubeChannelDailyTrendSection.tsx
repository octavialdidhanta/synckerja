import { useTranslation } from "react-i18next";
import type { YouTubeChannelDailyTrendRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YouTubeDailyTrendLineChart } from "@/6-0-social-media-performance/components/youtube-analytics/charts/YouTubeDailyTrendLineChart";

type Props = {
  rows: YouTubeChannelDailyTrendRow[];
  isLoading?: boolean;
};

export function YouTubeChannelDailyTrendSection({ rows, isLoading }: Props) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("digitalMarketing.youtubeContent.analytics.trend.title", "Daily trend")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "digitalMarketing.youtubeContent.analytics.trend.subtitle",
          "Views and watch time by day for the selected period.",
        )}
      </p>
      <div className="mt-4">
        {isLoading ? (
          <div className="h-[280px] animate-pulse rounded-md bg-muted/40" />
        ) : (
          <YouTubeDailyTrendLineChart rows={rows} />
        )}
      </div>
    </section>
  );
}
