import { startOfDay, subMonths } from "date-fns";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";

/** Meta Insights API (#3018): start date cannot be more than 37 months before today. */
export const META_ADS_MAX_LOOKBACK_MONTHS = 37;

export type MetaAdsDateRangePayload = { start: string; end: string };

export function metaAdsEarliestAllowedStartYmd(now: Date = new Date()): string {
  return toYmdLocal(startOfDay(subMonths(startOfDay(now), META_ADS_MAX_LOOKBACK_MONTHS)));
}

/** Calendar years selectable in Meta date picker (Meta API lookback window). */
export function buildMetaAdsCalendarYearPresetYears(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const parsed = parseYmdLocal(metaAdsEarliestAllowedStartYmd(now));
  const startYear = parsed ? parsed.getFullYear() : current;
  const years: number[] = [];
  for (let y = current; y >= startYear; y--) years.push(y);
  return years;
}

/** All time on Meta = exactly 37 months through today (API max lookback). */
export function metaAdsAllTimeDateRange(now: Date = new Date()): MetaAdsDateRangePayload & {
  wasStartClamped: boolean;
} {
  const end = toYmdLocal(startOfDay(now));
  const start = metaAdsEarliestAllowedStartYmd(now);
  return { start, end, wasStartClamped: true };
}

/**
 * Clamps `start` to Meta's maximum lookback from today. Ensures start <= end.
 */
export function clampMetaAdsDateRange(
  start: string,
  end: string,
  now: Date = new Date(),
): MetaAdsDateRangePayload & { wasStartClamped: boolean } {
  const minStartYmd = metaAdsEarliestAllowedStartYmd(now);
  const minStart = parseYmdLocal(minStartYmd)!;
  const startDate = parseYmdLocal(start.trim());
  const endDate = parseYmdLocal(end.trim());

  let effectiveEnd = endDate ?? startOfDay(now);
  let effectiveStart = startDate ?? minStart;

  if (effectiveStart.getTime() < minStart.getTime()) {
    effectiveStart = minStart;
  }
  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    effectiveStart = effectiveEnd;
  }

  const wasStartClamped =
    startDate != null && startDate.getTime() < minStart.getTime();

  return {
    start: toYmdLocal(effectiveStart),
    end: toYmdLocal(effectiveEnd),
    wasStartClamped,
  };
}
