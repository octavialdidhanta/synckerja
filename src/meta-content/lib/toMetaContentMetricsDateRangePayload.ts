import { startOfDay } from 'date-fns';
import type { GoogleAdsDateRangeSelection } from '@/6-0-google-ads/lib/googleAdsDatePresets';
import {
  toGoogleAdsMetricsDateRangePayload,
  toYmdLocal,
} from '@/6-0-google-ads/lib/googleAdsDatePresets';

export type MetaPostDateRangePayload = {
  start?: string;
  end?: string;
  wasStartClamped: boolean;
  /** All time = up to 50 most recent posts; no publish-date filter (IG + FB). */
  isAllTime: boolean;
};

/**
 * Meta content post listing (Instagram + Facebook).
 * `all_time` skips publish-date filtering and loads recent posts (API cap 50).
 */
export function toMetaPostDateRangePayload(
  selection: GoogleAdsDateRangeSelection,
): MetaPostDateRangePayload {
  if (selection.preset === 'all_time') {
    return { wasStartClamped: false, isAllTime: true };
  }

  const base = toGoogleAdsMetricsDateRangePayload(selection);
  const todayYmd = toYmdLocal(startOfDay(new Date()));

  let end = base.end;
  if (end > todayYmd) end = todayYmd;

  let start = base.start;
  if (start > end) start = end;

  return { start, end, wasStartClamped: false, isAllTime: false };
}

/** Edge function args: all_time omits dates (50 most recent posts). */
export function metaContentMetricsFetchArgs(
  selection: GoogleAdsDateRangeSelection,
): { dateStart?: string; dateEnd?: string } {
  const range = toMetaPostDateRangePayload(selection);
  if (range.isAllTime) return {};
  return { dateStart: range.start, dateEnd: range.end };
}

/** @deprecated Use toMetaPostDateRangePayload. */
export const toInstagramPostDateRangePayload = toMetaPostDateRangePayload;

/** @deprecated Use toMetaPostDateRangePayload. */
export const toMetaContentMetricsDateRangePayload = toMetaPostDateRangePayload;
