import { startOfDay, subDays } from "date-fns";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";

/** TikTok Reporting API: start date cannot be more than 365 days before today. */
export const TIKTOK_ADS_MAX_LOOKBACK_DAYS = 365;

export type TikTokAdsDateRangePayload = { start: string; end: string };

export function tiktokAdsEarliestAllowedStartYmd(now: Date = new Date()): string {
  return toYmdLocal(startOfDay(subDays(startOfDay(now), TIKTOK_ADS_MAX_LOOKBACK_DAYS)));
}

/** Calendar years selectable in TikTok date picker (API lookback window). */
export function buildTikTokAdsCalendarYearPresetYears(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const parsed = parseYmdLocal(tiktokAdsEarliestAllowedStartYmd(now));
  const startYear = parsed ? parsed.getFullYear() : current;
  const years: number[] = [];
  for (let y = current; y >= startYear; y--) years.push(y);
  return years;
}

/** All time on TikTok = exactly 365 days through today (API max lookback). */
export function tiktokAdsAllTimeDateRange(now: Date = new Date()): TikTokAdsDateRangePayload & {
  wasStartClamped: boolean;
} {
  const end = toYmdLocal(startOfDay(now));
  const start = tiktokAdsEarliestAllowedStartYmd(now);
  return { start, end, wasStartClamped: true };
}

/**
 * Clamps `start` to TikTok's maximum lookback from today. Ensures start <= end.
 */
export function clampTikTokAdsDateRange(
  start: string,
  end: string,
  now: Date = new Date(),
): TikTokAdsDateRangePayload & { wasStartClamped: boolean } {
  const minStartYmd = tiktokAdsEarliestAllowedStartYmd(now);
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
