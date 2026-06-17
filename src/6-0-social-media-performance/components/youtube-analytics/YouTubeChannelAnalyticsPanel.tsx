import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useTranslation } from "react-i18next";
import type { YouTubeChannelAnalyticsResponse } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";
import { YouTubeChannelAnalyticsOverview } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubeChannelAnalyticsOverview";
import { YouTubeChannelDemographicsSection } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubeChannelDemographicsSection";
import { YouTubeChannelTrafficSourceSection } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubeChannelTrafficSourceSection";
import { YouTubeChannelDailyTrendSection } from "@/6-0-social-media-performance/components/youtube-analytics/YouTubeChannelDailyTrendSection";

type Props = {
  data: YouTubeChannelAnalyticsResponse | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isAllTimeRange?: boolean;
};

export function YouTubeChannelAnalyticsPanel({
  data,
  isLoading,
  isError,
  error,
  isAllTimeRange = false,
}: Props) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>
            {t("digitalMarketing.youtubeContent.analytics.error", "Failed to load channel analytics")}
          </AlertTitle>
          <AlertDescription>
            {error?.message ??
              t(
                "digitalMarketing.youtubeContent.analytics.errorGeneric",
                "An error occurred while loading YouTube channel analytics.",
              )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4">
        <YouTubeChannelAnalyticsOverview overview={data?.overview} isLoading={isLoading} />
        {!isLoading && data ? (
          <p className="text-xs text-muted-foreground">
            {isAllTimeRange
              ? t(
                  "digitalMarketing.youtubeContent.analytics.periodHintAllTime",
                  "Metrics use YouTube Analytics from Jan 2012 through today. The Videos tab sums lifetime view counts per upload.",
                )
              : t(
                  "digitalMarketing.youtubeContent.analytics.periodHint",
                  "Metrics count activity during the selected date range. The Videos tab shows lifetime view counts for uploads published in that range.",
                )}
          </p>
        ) : null}
        <YouTubeChannelDemographicsSection rows={data?.demographics ?? []} isLoading={isLoading} />
        <YouTubeChannelTrafficSourceSection rows={data?.traffic_sources ?? []} isLoading={isLoading} />
        <YouTubeChannelDailyTrendSection rows={data?.daily_trend ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
