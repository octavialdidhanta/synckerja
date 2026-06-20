import { startOfDay } from 'date-fns';
import type { GoogleAdsDateRangeSelection } from '@/6-0-google-ads/lib/googleAdsDatePresets';
import {
  toGoogleAdsMetricsDateRangePayload,
  toYmdLocal,
} from '@/6-0-google-ads/lib/googleAdsDatePresets';

export type ThreadsPostDateRangePayload = {
  start?: string;
  end?: string;
  isAllTime: boolean;
};

/** Threads launched mid-2023; allow earlier YMD for calendar / all-time window. */
export const THREADS_EARLIEST_YMD = '2022-01-01';
export function toThreadsPostDateRangePayload(
  selection: GoogleAdsDateRangeSelection,
): ThreadsPostDateRangePayload {
  if (selection.preset === 'all_time') {
    return { isAllTime: true };
  }

  const base = toGoogleAdsMetricsDateRangePayload(selection);
  const todayYmd = toYmdLocal(startOfDay(new Date()));

  let end = base.end;
  if (end > todayYmd) end = todayYmd;

  let start = base.start;
  if (start > end) start = end;

  return { start, end, isAllTime: false };
}

/** Edge function body args for threads-content-api post listing. */
export function threadsContentMetricsFetchArgs(
  selection: GoogleAdsDateRangeSelection,
): { dateStart?: string; dateEnd?: string; allTime?: boolean } {
  const range = toThreadsPostDateRangePayload(selection);
  if (range.isAllTime) return { allTime: true };
  return { dateStart: range.start, dateEnd: range.end };
}

/** Calendar years in Threads date picker (supports posts back to 2022). */
export function buildThreadsCalendarYearPresetYears(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const startYear = 2022;
  const years: number[] = [];
  for (let y = current; y >= startYear; y--) years.push(y);
  return years;
}
