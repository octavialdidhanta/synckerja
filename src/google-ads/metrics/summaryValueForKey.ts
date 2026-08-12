import type {
  GoogleAdsMetricsSummaryTotals,
  GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/types";

/** Resolve a summary-slot metric value from totals (by_key first, then legacy fields). */
export function summaryValueForKey(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  key: string,
  _valueKind?: GoogleAdsSummaryMetricOption["valueKind"],
): number | null {
  if (!totals) return null;
  if (totals.by_key && key in totals.by_key) {
    return totals.by_key[key] ?? null;
  }
  if (key === "spent") return totals.spent;
  if (key === "impressions") return totals.impressions;
  if (key === "clicks") return totals.clicks;
  if (key === "ctr") return totals.ctr;
  if (key === "conversions") return totals.conversions;
  return null;
}
