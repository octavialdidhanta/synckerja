import type { TrafficIngestionStatus } from "@/6-0-traffic/hooks/useTrafficDashboardController";

function ymdOnly(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export type TrafficQueryDateBounds = {
  queryFromDate: string | null;
  queryToDate: string | null;
  queryDateReady: boolean;
};

/** Align drill-down RPC dates with get_traffic_dashboard (aggregate bounds, then raw fallback). */
export function resolveTrafficQueryDateBounds(
  rangeIsMaximum: boolean,
  fromDate: string | null,
  toDate: string | null,
  ingestion: TrafficIngestionStatus | null | undefined,
): TrafficQueryDateBounds {
  if (!rangeIsMaximum) {
    const queryFromDate = ymdOnly(fromDate);
    const queryToDate = ymdOnly(toDate);
    return {
      queryFromDate,
      queryToDate,
      queryDateReady: Boolean(queryFromDate && queryToDate),
    };
  }

  const queryFromDate =
    ymdOnly(ingestion?.aggregate_day_min ?? null) ?? ymdOnly(ingestion?.raw_day_min ?? null);
  const queryToDate =
    ymdOnly(ingestion?.aggregate_day_max ?? null) ?? ymdOnly(ingestion?.raw_day_max ?? null);

  return {
    queryFromDate,
    queryToDate,
    queryDateReady: Boolean(queryFromDate && queryToDate),
  };
}
