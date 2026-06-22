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
  /** All time = paginate all published posts (no publish-date filter). */
  isAllTime: boolean;
};

/**
 * Meta content post listing (Instagram + Facebook).
 * `all_time` paginates through publish history; dated presets filter by publish date.
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

/** Edge function args: all_time sends flag; dated presets send start/end YMD. */
export function metaContentMetricsFetchArgs(
  selection: GoogleAdsDateRangeSelection,
): { dateStart?: string; dateEnd?: string; allTime?: boolean } {
  const range = toMetaPostDateRangePayload(selection);
  if (range.isAllTime) return { allTime: true };
  return { dateStart: range.start, dateEnd: range.end };
}

/** @deprecated Use toMetaPostDateRangePayload. */
export const toInstagramPostDateRangePayload = toMetaPostDateRangePayload;

/** @deprecated Use toMetaPostDateRangePayload. */
export const toMetaContentMetricsDateRangePayload = toMetaPostDateRangePayload;
