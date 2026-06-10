import {
  toGoogleAdsMetricsDateRangePayload,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  clampTikTokAdsDateRange,
  tiktokAdsAllTimeDateRange,
} from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

/** Date range for TikTok Reporting — same presets as Google Ads, with TikTok API lookback clamp. */
export function toTikTokAdsMetricsDateRangePayload(
  selection: GoogleAdsDateRangeSelection,
): ReturnType<typeof clampTikTokAdsDateRange> {
  if (selection.preset === "all_time") {
    return tiktokAdsAllTimeDateRange();
  }
  const base = toGoogleAdsMetricsDateRangePayload(selection);
  return clampTikTokAdsDateRange(base.start, base.end);
}
