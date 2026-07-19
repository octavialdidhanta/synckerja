const MS_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 365 * MS_DAY;
const DEFAULT_RANGE_MS = 7 * MS_DAY;

export type BlibliOrderDateRange = {
  start: number;
  end: number;
};

/** Default: last 7 days ending now. */
export function defaultBlibliOrderDateRange(nowMs = Date.now()): BlibliOrderDateRange {
  return clampBlibliOrderDateRange({
    start: nowMs - DEFAULT_RANGE_MS,
    end: nowMs,
  }, nowMs);
}

/** Clamp to max 1 year; ensure start < end. */
export function clampBlibliOrderDateRange(
  range: BlibliOrderDateRange,
  nowMs = Date.now(),
): BlibliOrderDateRange {
  let start = Number(range.start);
  let end = Number(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return defaultBlibliOrderDateRange(nowMs);
  }
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const minStart = nowMs - MAX_RANGE_MS;
  if (start < minStart) start = minStart;
  if (end > nowMs + MS_DAY) end = nowMs + MS_DAY;
  if (end - start > MAX_RANGE_MS) start = end - MAX_RANGE_MS;
  if (start >= end) start = end - MS_DAY;
  return { start, end };
}

export const BLIBLI_ORDERS_DEFAULT_PAGE_SIZE = 20;
export const BLIBLI_ORDERS_MAX_PAGE_SIZE = 50;
