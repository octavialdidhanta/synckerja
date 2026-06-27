import type { UtmTableMetricsSlice } from "@/6-0-traffic/lib/utmTableMetrics";
import type { SourceBreakdownTotals } from "@/6-0-traffic/lib/normalizeSourceBreakdownRows";

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
