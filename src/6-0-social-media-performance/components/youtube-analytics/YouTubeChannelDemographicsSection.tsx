import { useTranslation } from "react-i18next";
import type { YouTubeChannelDemographicsRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YouTubeDemographicsBarChart } from "@/6-0-social-media-performance/components/youtube-analytics/charts/YouTubeDemographicsBarChart";

type Props = {
  rows: YouTubeChannelDemographicsRow[];
  isLoading?: boolean;
};

export function YouTubeChannelDemographicsSection({ rows, isLoading }: Props) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("digitalMarketing.youtubeContent.analytics.demographics.title", "Audience demographics")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "digitalMarketing.youtubeContent.analytics.demographics.subtitle",
          "Viewer percentage by age group and gender for the selected period.",
        )}
      </p>
      <div className="mt-4">
        {isLoading ? (
          <div className="h-[280px] animate-pulse rounded-md bg-muted/40" />
        ) : (
          <YouTubeDemographicsBarChart rows={rows} />
        )}
      </div>
    </section>
  );
}
