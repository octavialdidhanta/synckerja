import { useTranslation } from "react-i18next";
import type { YouTubeChannelTrafficSourceRow } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YouTubeTrafficSourceBarChart } from "@/6-0-social-media-performance/components/youtube-analytics/charts/YouTubeTrafficSourceBarChart";

type Props = {
  rows: YouTubeChannelTrafficSourceRow[];
  isLoading?: boolean;
};

export function YouTubeChannelTrafficSourceSection({ rows, isLoading }: Props) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("digitalMarketing.youtubeContent.analytics.traffic.title", "Traffic sources")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "digitalMarketing.youtubeContent.analytics.traffic.subtitle",
          "Where viewers found your channel content during the selected period.",
        )}
      </p>
      <div className="mt-4">
        {isLoading ? (
          <div className="h-[280px] animate-pulse rounded-md bg-muted/40" />
        ) : (
          <YouTubeTrafficSourceBarChart rows={rows} />
        )}
      </div>
    </section>
  );
}
