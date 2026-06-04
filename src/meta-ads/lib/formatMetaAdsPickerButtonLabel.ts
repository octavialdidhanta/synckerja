import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { formatGoogleAdsPickerButtonLabel } from "@/6-0-google-ads/lib/googleAdsDatePresets";

/** Meta uses the same preset + range label pattern as Google Ads (all_time = 37-month window in range). */
export function formatMetaAdsPickerButtonLabel(
  selection: GoogleAdsDateRangeSelection,
): string {
  return formatGoogleAdsPickerButtonLabel(selection);
}
