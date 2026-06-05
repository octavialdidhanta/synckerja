import {
  computePresetRange,
  dateSelectionForCalendarYear,
  intersectDateSelectionWithChartYear,
  parseYmdLocal,
  toGoogleAdsMetricsDateRangePayload,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  metaAdsAllTimeDateRange,
  type MetaAdsDateRangePayload,
} from "@/meta-ads/lib/clampMetaAdsDateRange";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";

/** Years from account earliest (or last N) through today, newest first. */
export function buildReportYearOptionsFromEarliest(
  accountEarliestYmd?: string | null,
  minSpanYears = 6,
): number[] {
  const current = new Date().getFullYear();
  let startYear = current - Math.max(1, minSpanYears) + 1;
  if (accountEarliestYmd) {
    const parsed = parseYmdLocal(accountEarliestYmd);
    if (parsed) startYear = Math.min(startYear, parsed.getFullYear());
  }
  startYear = Math.min(startYear, current);
  const years: number[] = [];
  for (let y = current; y >= startYear; y--) years.push(y);
  return years;
}

/** All time on Report / Google tabs: first account activity through today. */
export function googleAdsAllTimeSelection(
  accountEarliestYmd?: string | null,
  rollingDays = 30,
): GoogleAdsDateRangeSelection {
  const range = computePresetRange("all_time", new Date(), { accountEarliestYmd });
  return { preset: "all_time", range, rollingDays };
}

function resolveReportEffectiveSelection(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  accountEarliestYmd?: string | null,
): GoogleAdsDateRangeSelection | null {
  if (dateSelection.preset === "calendar_year" && dateSelection.calendarYear != null) {
    return dateSelectionForCalendarYear(dateSelection.calendarYear);
  }
  if (dateSelection.preset === "all_time") {
    const sel = googleAdsAllTimeSelection(accountEarliestYmd, dateSelection.rollingDays);
    const from = sel.range.from;
    const to = sel.range.to;
    if (!from || !to) return null;
    return sel;
  }
  return intersectDateSelectionWithChartYear(dateSelection, reportChartYear);
}

/**
 * Report Google metrics: All time follows Google account bounds, not Meta's 37-month window.
 */
export function resolveReportGoogleDateRangePayload(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  accountEarliestYmd?: string | null,
): ReturnType<typeof toGoogleAdsMetricsDateRangePayload> {
  const effective = resolveReportEffectiveSelection(
    dateSelection,
    reportChartYear,
    accountEarliestYmd,
  );
  if (!effective) {
    return toGoogleAdsMetricsDateRangePayload(dateSelection);
  }
  return toGoogleAdsMetricsDateRangePayload(effective);
}

/**
 * Report Meta metrics: All time stays within Meta API lookback (37 months).
 */
export function resolveReportMetaDateRangePayload(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
): MetaAdsDateRangePayload & { wasStartClamped: boolean } {
  if (dateSelection.preset === "all_time") {
    return metaAdsAllTimeDateRange();
  }
  const effective = resolveReportEffectiveSelection(dateSelection, reportChartYear);
  if (!effective) {
    return toMetaAdsMetricsDateRangePayload(dateSelection);
  }
  return toMetaAdsMetricsDateRangePayload(effective);
}

/** True when the picker range ends before Meta's earliest allowed Insights start. */
export function isReportMetaRangeUnavailable(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  accountEarliestYmd?: string | null,
): boolean {
  const google = resolveReportGoogleDateRangePayload(
    dateSelection,
    reportChartYear,
    accountEarliestYmd,
  );
  return google.end < metaAdsAllTimeDateRange().start;
}

/** Chart/table window for overlap checks. */
export function resolveReportChartDateSelection(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  accountEarliestYmd?: string | null,
): GoogleAdsDateRangeSelection | null {
  return resolveReportEffectiveSelection(
    dateSelection,
    reportChartYear,
    accountEarliestYmd,
  );
}

/**
 * Report Spend/CPA/Leads charts when Compare is ON: full calendar year for reportChartYear.
 * Otherwise same as resolveReportChartDateSelection.
 */
export function resolveReportChartMonthlyDateSelection(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  compareEnabled: boolean,
  accountEarliestYmd?: string | null,
): GoogleAdsDateRangeSelection | null {
  if (compareEnabled) {
    return dateSelectionForCalendarYear(reportChartYear);
  }
  return resolveReportChartDateSelection(
    dateSelection,
    reportChartYear,
    accountEarliestYmd,
  );
}

export function resolveReportGoogleDateRangePayloadForCharts(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  compareEnabled: boolean,
  accountEarliestYmd?: string | null,
): ReturnType<typeof toGoogleAdsMetricsDateRangePayload> {
  const effective = resolveReportChartMonthlyDateSelection(
    dateSelection,
    reportChartYear,
    compareEnabled,
    accountEarliestYmd,
  );
  if (!effective) {
    return toGoogleAdsMetricsDateRangePayload(dateSelection);
  }
  return toGoogleAdsMetricsDateRangePayload(effective);
}

export function resolveReportMetaDateRangePayloadForCharts(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  compareEnabled: boolean,
): MetaAdsDateRangePayload & { wasStartClamped: boolean } {
  if (compareEnabled) {
    const effective = dateSelectionForCalendarYear(reportChartYear);
    return toMetaAdsMetricsDateRangePayload(effective);
  }
  if (dateSelection.preset === "all_time") {
    return metaAdsAllTimeDateRange();
  }
  const effective = resolveReportEffectiveSelection(dateSelection, reportChartYear);
  if (!effective) {
    return toMetaAdsMetricsDateRangePayload(dateSelection);
  }
  return toMetaAdsMetricsDateRangePayload(effective);
}

/** Meta unavailable check for chart monthly fetch (Compare uses calendar year, not all-time Meta window). */
export function isReportMetaRangeUnavailableForCharts(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  compareEnabled: boolean,
  accountEarliestYmd?: string | null,
): boolean {
  const google = resolveReportGoogleDateRangePayloadForCharts(
    dateSelection,
    reportChartYear,
    compareEnabled,
    accountEarliestYmd,
  );
  return google.end < metaAdsAllTimeDateRange().start;
}
