import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { getLast30DaysDateRange } from "@/5-3-dashboard/components/leads/filters/dateRangePresets";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export type TrafficDashboardPayload = {
  web_id: string;
  from: string | null;
  to: string | null;
  kpis: {
    sessions: number;
    page_views: number;
    clicks: number;
    avg_active_ms_per_view: number;
    sessions_with_utm: number;
    sessions_with_gclid: number;
  };
  series: Array<{ day: string; sessions: number; page_views: number; clicks: number }>;
  top_pages: Array<{
    path: string;
    impr: number;
    unique_sessions: number;
    clicks: number;
    median_active_ms: number;
    avg_active_ms: number;
    n: number;
    max_deep_scroll_pct?: number | null;
    avg_max_deep_scroll_pct?: number | null;
    click_event_name?: string;
    click_track_key?: string | null;
    click_element_type?: string | null;
    click_element_label?: string | null;
    click_target_url?: string | null;
    click_is_internal?: boolean | null;
  }>;
  top_clicks: Array<{
    path: string;
    track_key: string | null;
    element_type: string;
    element_label: string;
    clicks: number;
  }>;
  utm_table: Array<{
    route: string | null;
    utm_campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_content: string | null;
    utm_term: string | null;
    sessions: number;
    page_views?: number;
    clicks?: number;
    max_deep_scroll_pct?: number | null;
    avg_max_deep_scroll_pct?: number | null;
    scroll_sessions?: number;
  }>;
  funnel: { sessions: number; page_views: number; clicks: number };
  source_breakdown?: Array<{
    key: string;
    label: string;
    sessions: number;
    page_views: number;
    clicks: number;
    max_deep_scroll_pct?: number | null;
    avg_max_deep_scroll_pct?: number | null;
    scroll_sessions?: number;
  }>;
};

export type TrafficIngestionStatus = {
  raw_events_exist: boolean;
  daily_rollups_exist: boolean;
  /** YYYY-MM-DD; null jika belum ada baris agregat untuk web_id */
  aggregate_day_min?: string | null;
  aggregate_day_max?: string | null;
  data_status: "ok" | "no_ingested_data" | "rollups_not_built";
};

export function useTrafficDashboardController() {
  const { organizationId } = useCurrentOrg();
  const [webId, setWebId] = useState<string>("");
  /** Default: 30 hari terakhir agar dashboard sejalan dengan trafik aktual; "Maximum" pilih lewat filter. */
  const [range, setRange] = useState<DateRange | null>(() => getLast30DaysDateRange());

  const webIdsQuery = useQuery({
    queryKey: ["traffic", "accessible-web-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accessible_web_ids");
      if (error) throw error;
      return ((data ?? []) as Array<{ web_id: string }>).map((r) => r.web_id);
    },
  });

  const effectiveWebId = useMemo(() => {
    const trimmed = webId.trim();
    return trimmed || (webIdsQuery.data?.[0] ?? "");
  }, [webId, webIdsQuery.data]);

  const fromDate = useMemo(() => {
    if (!range?.from) return null;
    return format(range.from, "yyyy-MM-dd");
  }, [range?.from]);

  const toDate = useMemo(() => {
    if (!range?.to) return null;
    return format(range.to, "yyyy-MM-dd");
  }, [range?.to]);

  const rangeIsMaximum = range === null;

  const dashboardQuery = useQuery({
    queryKey: ["traffic", "dashboard", effectiveWebId, fromDate, toDate],
    enabled:
      Boolean(organizationId) &&
      Boolean(effectiveWebId) &&
      (range === null || (Boolean(fromDate) && Boolean(toDate))),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_dashboard", {
        p_web_id: effectiveWebId,
        p_from: range === null ? null : fromDate,
        p_to: range === null ? null : toDate,
        p_utm_limit: 2000,
      });
      if (error) throw error;
      const raw = data as TrafficDashboardPayload;
      // RPC lama (top_pages: page_views) vs baru (impr); filter tanggal pakai `day` di DB, bukan UTC di sini
      const topPages = (raw.top_pages ?? []).map((row) => {
        const r = row as unknown as { impr?: unknown; page_views?: unknown };
        const impr = r.impr ?? r.page_views;
        return { ...row, impr: Number(impr ?? 0) };
      });
      return { ...raw, top_pages: topPages } as TrafficDashboardPayload;
    },
  });

  const ingestionQuery = useQuery({
    queryKey: ["traffic", "ingestion", organizationId, effectiveWebId],
    enabled: Boolean(organizationId) && Boolean(effectiveWebId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_ingestion_status", {
        p_web_id: effectiveWebId,
      });
      if (error) throw error;
      return data as TrafficIngestionStatus;
    },
  });

  return {
    organizationId,
    webId,
    setWebId,
    range,
    setRange,
    webIdsQuery,
    effectiveWebId,
    fromDate,
    toDate,
    rangeIsMaximum,
    dashboardQuery,
    ingestionQuery,
  };
}

