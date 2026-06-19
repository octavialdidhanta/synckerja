import { startOfDay } from "date-fns";
import { toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";

/** Earliest date supported by YouTube Analytics API reports. */
export const YOUTUBE_ANALYTICS_EARLIEST_YMD = "2012-01-01";

export type YouTubeAnalyticsDateRange = { start: string; end: string };

/** All time for YouTube Analytics — full API history, not TikTok's 365-day cap. */
export function youtubeAnalyticsAllTimeDateRange(now: Date = new Date()): YouTubeAnalyticsDateRange {
  return {
    start: YOUTUBE_ANALYTICS_EARLIEST_YMD,
    end: toYmdLocal(startOfDay(now)),
  };
}

export function resolveYouTubeChannelAnalyticsDateRange(
  preset: string,
  selectionRange: YouTubeAnalyticsDateRange,
): YouTubeAnalyticsDateRange {
  if (preset === "all_time") {
    return youtubeAnalyticsAllTimeDateRange();
  }
  return selectionRange;
}
