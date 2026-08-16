import { EMPTY_UTM_TABLE_METRICS, type UtmTableMetricsSlice } from "@/6-0-traffic/lib/utmTableMetrics";
import {
  computeSourceBreakdownTotals,
  normalizeSourceBreakdownRows,
  type SourceBreakdownTotals,
} from "@/6-0-traffic/lib/normalizeSourceBreakdownRows";

export type TrafficKpis = {
  sessions: number;
  page_views: number;
  clicks: number;
};

export type TrafficKpiDisplay = {
  sessionsDisplay: number | null;
  pageViewsDisplay: number | null;
  clicksDisplay: number | null;
};

export function computeTrafficKpiDisplay(opts: {
  kpis: TrafficKpis | null;
  utmTableMetrics: UtmTableMetricsSlice;
  hasSourceBreakdown: boolean;
  sourceBreakdownTotals: SourceBreakdownTotals;
}): TrafficKpiDisplay {
  const { kpis, utmTableMetrics, hasSourceBreakdown, sourceBreakdownTotals } = opts;

  if (kpis == null) {
    return { sessionsDisplay: null, pageViewsDisplay: null, clicksDisplay: null };
  }

  const sessionsDisplay = utmTableMetrics.utmFiltersActive
    ? utmTableMetrics.filteredSessionsSum
    : hasSourceBreakdown
      ? sourceBreakdownTotals.sessions
      : kpis.sessions;

  const pageViewsDisplay = utmTableMetrics.utmFiltersActive
    ? utmTableMetrics.filteredPageViewsSum
    : kpis.page_views;

  const clicksDisplay = utmTableMetrics.utmFiltersActive
    ? utmTableMetrics.filteredClicksSum
    : kpis.clicks;

  return { sessionsDisplay, pageViewsDisplay, clicksDisplay };
}

/** Period comparison always uses unfiltered KPI totals (source breakdown when present). */
export function computeUnfilteredTrafficKpiDisplay(opts: {
  kpis: TrafficKpis | null;
  sourceBreakdown: unknown;
}): TrafficKpiDisplay {
  const rows = normalizeSourceBreakdownRows(opts.sourceBreakdown);
  return computeTrafficKpiDisplay({
    kpis: opts.kpis,
    utmTableMetrics: EMPTY_UTM_TABLE_METRICS,
    hasSourceBreakdown: rows.length > 0,
    sourceBreakdownTotals: computeSourceBreakdownTotals(rows),
  });
}
