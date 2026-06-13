import { startOfDay, subDays } from "date-fns";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";

/** TikTok Shop order search: start date cannot be more than 365 days before today. */
export const TIKTOK_SHOP_MAX_LOOKBACK_DAYS = 365;

export type TikTokShopDateRangePayload = { start: string; end: string };

export function tiktokShopEarliestAllowedStartYmd(now: Date = new Date()): string {
  return toYmdLocal(startOfDay(subDays(startOfDay(now), TIKTOK_SHOP_MAX_LOOKBACK_DAYS)));
}

export function buildTikTokShopCalendarYearPresetYears(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const parsed = parseYmdLocal(tiktokShopEarliestAllowedStartYmd(now));
  const startYear = parsed ? parsed.getFullYear() : current;
  const years: number[] = [];
  for (let y = current; y >= startYear; y--) years.push(y);
  return years;
}

export function tiktokShopAllTimeDateRange(now: Date = new Date()): TikTokShopDateRangePayload & {
  wasStartClamped: boolean;
} {
  const end = toYmdLocal(startOfDay(now));
  const start = tiktokShopEarliestAllowedStartYmd(now);
  return { start, end, wasStartClamped: true };
}

export function tiktokShopDefaultDateRange(now: Date = new Date()): TikTokShopDateRangePayload {
  const end = toYmdLocal(startOfDay(now));
  const start = toYmdLocal(startOfDay(subDays(startOfDay(now), 29)));
  return { start, end };
}

/**
 * Clamps `start` to TikTok Shop's maximum lookback from today. Ensures start <= end.
 */
export function clampTikTokShopDateRange(
  start: string,
  end: string,
  now: Date = new Date(),
): TikTokShopDateRangePayload & { wasStartClamped: boolean } {
  const minStartYmd = tiktokShopEarliestAllowedStartYmd(now);
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
