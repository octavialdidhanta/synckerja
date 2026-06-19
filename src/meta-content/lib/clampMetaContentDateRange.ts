import { startOfDay, subDays } from 'date-fns';
import { parseYmdLocal, toYmdLocal } from '@/6-0-google-ads/lib/googleAdsDatePresets';

/** IG + FB account insights: since/until span cannot exceed 30 days (Graph API #100). */
export const META_CONTENT_MAX_INSIGHT_DAYS = 30;
export const META_CONTENT_MAX_INSIGHT_SECONDS = META_CONTENT_MAX_INSIGHT_DAYS * 86400;

export type MetaContentDateRangePayload = { start: string; end: string };

export function metaContentEarliestAllowedStartYmd(now: Date = new Date()): string {
  return toYmdLocal(
    startOfDay(subDays(startOfDay(now), META_CONTENT_MAX_INSIGHT_DAYS - 1)),
  );
}

export function buildMetaContentCalendarYearPresetYears(now: Date = new Date()): number[] {
  return [now.getFullYear()];
}

/** All time for Meta organic insights = last 30 days through today (API max window). */
export function metaContentAllTimeDateRange(now: Date = new Date()): MetaContentDateRangePayload & {
  wasStartClamped: boolean;
} {
  const end = toYmdLocal(startOfDay(now));
  const start = metaContentEarliestAllowedStartYmd(now);
  return { start, end, wasStartClamped: true };
}

/**
 * Clamps the range to Meta's 30-day insights window. If the span exceeds 30 days,
 * `start` moves forward so the window ends on `end`.
 */
export function clampMetaContentDateRange(
  start: string,
  end: string,
  now: Date = new Date(),
): MetaContentDateRangePayload & { wasStartClamped: boolean } {
  const maxStartYmd = metaContentEarliestAllowedStartYmd(now);
  const maxStart = parseYmdLocal(maxStartYmd)!;
  const startDate = parseYmdLocal(start.trim());
  const endDate = parseYmdLocal(end.trim());

  let effectiveEnd = endDate ?? startOfDay(now);
  let effectiveStart = startDate ?? maxStart;

  const today = startOfDay(now);
  if (effectiveEnd.getTime() > today.getTime()) {
    effectiveEnd = today;
  }

  const minStartForEnd = startOfDay(
    subDays(effectiveEnd, META_CONTENT_MAX_INSIGHT_DAYS - 1),
  );
  if (effectiveStart.getTime() < minStartForEnd.getTime()) {
    effectiveStart = minStartForEnd;
  }
  if (effectiveStart.getTime() < maxStart.getTime()) {
    effectiveStart = maxStart;
  }
  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    effectiveStart = effectiveEnd;
  }

  const wasStartClamped =
    (startDate != null && startDate.getTime() < effectiveStart.getTime()) ||
    (endDate != null && endDate.getTime() > today.getTime());

  return {
    start: toYmdLocal(effectiveStart),
    end: toYmdLocal(effectiveEnd),
    wasStartClamped,
  };
}
