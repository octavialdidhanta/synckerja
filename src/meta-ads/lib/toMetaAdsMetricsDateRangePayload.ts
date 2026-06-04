import {
  toGoogleAdsMetricsDateRangePayload,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  clampMetaAdsDateRange,
  metaAdsAllTimeDateRange,
} from "@/meta-ads/lib/clampMetaAdsDateRange";

/** Date range for Meta Insights — same presets as Google Ads, with Meta API lookback clamp. */
export function toMetaAdsMetricsDateRangePayload(
  selection: GoogleAdsDateRangeSelection,
): ReturnType<typeof clampMetaAdsDateRange> {
  if (selection.preset === "all_time") {
    return metaAdsAllTimeDateRange();
  }
  const base = toGoogleAdsMetricsDateRangePayload(selection);
  return clampMetaAdsDateRange(base.start, base.end);
}
