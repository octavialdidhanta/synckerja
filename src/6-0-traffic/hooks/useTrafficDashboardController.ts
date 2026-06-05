import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolveTrafficDateRangeFromSelection } from "@/6-0-digital-marketing-shared/lib/resolveTrafficDateRange";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
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
    visit_key?: string | null;
    visitor_id?: string | null;
    session_id?: string | null;
    day?: string | null;
    occurred_at?: string | null;
    time_label?: string | null;
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

export type TrafficWebAccessRequest = {
  web_id: string;
  is_approved: boolean;
  created_at: string | null;
};

function ymdOnly(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function emptyTrafficDashboard(webId: string): TrafficDashboardPayload {
  return {
    web_id: webId,
    from: null,
    to: null,
    kpis: {
      sessions: 0,
      page_views: 0,
      clicks: 0,
      avg_active_ms_per_view: 0,
      sessions_with_utm: 0,
      sessions_with_gclid: 0,
    },
    series: [],
    top_pages: [],
    top_clicks: [],
    utm_table: [],
    funnel: { sessions: 0, page_views: 0, clicks: 0 },
    source_breakdown: [],
  };
}

export function useTrafficDashboardController() {
  const { organizationId } = useCurrentOrg();
  const {
    dateSelection,
    setDateSelection,
    reportChartYear,
    googleCustomerId,
    filtersHydrated,
  } = useDigitalMarketingPaidAdsFilters();
  const [webId, setWebId] = useState<string>("");

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    googleCustomerId || null,
    Boolean(organizationId && googleCustomerId),
  );

  const webIdsQuery = useQuery({
    queryKey: ["traffic", "accessible-web-ids", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accessible_web_ids");
      if (error) throw error;
      return ((data ?? []) as Array<{ web_id: string }>).map((r) => r.web_id);
    },
  });

  const webAccessQuery = useQuery({
    queryKey: ["traffic", "web-access-requests", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_web_access")
        .select("web_id,is_approved,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrafficWebAccessRequest[];
    },
  });

  // After org switch, React Query must not reuse another org's web_id list; also drop a stale manual selection.
  useEffect(() => {
    const ids = webIdsQuery.data;
    if (webIdsQuery.isLoading || ids === undefined) return;
    const trimmed = webId.trim();
    if (trimmed && !ids.includes(trimmed)) {
      setWebId("");
    }
  }, [webIdsQuery.data, webIdsQuery.isLoading, webId]);

  /**
   * Hanya pakai `webId` state jika ada di daftar RPC untuk org ini. Saat ganti org, `data` sementara
   * undefined: jangan fallback ke ID lama (bisa memicu `forbidden` di get_traffic_dashboard).
   */
  const effectiveWebId = useMemo(() => {
    const trimmed = webId.trim();
    const ids = webIdsQuery.data;
    if (!organizationId) return "";
    if (ids === undefined) return "";
    if (ids.length === 0) return "";
    if (trimmed && ids.includes(trimmed)) return trimmed;
    return ids[0] ?? "";
  }, [organizationId, webId, webIdsQuery.data]);

  const { fromDate, toDate, rangeIsMaximum } = useMemo(
    () =>
      resolveTrafficDateRangeFromSelection(
        dateSelection,
        reportChartYear,
        accountDateBounds?.earliest_date,
      ),
    [dateSelection, reportChartYear, accountDateBounds?.earliest_date],
  );

  const dashboardQuery = useQuery({
    queryKey: ["traffic", "dashboard", organizationId, effectiveWebId, fromDate, toDate],
    enabled:
      Boolean(organizationId) &&
      Boolean(effectiveWebId) &&
      filtersHydrated &&
      (rangeIsMaximum || (Boolean(fromDate) && Boolean(toDate))),
    queryFn: async () => {
      let rpcFrom: string | null = rangeIsMaximum ? null : ymdOnly(fromDate);
      let rpcTo: string | null = rangeIsMaximum ? null : ymdOnly(toDate);

      if (rangeIsMaximum) {
        const { data: ing, error: ingErr } = await supabase.rpc("get_traffic_ingestion_status", {
          p_web_id: effectiveWebId,
        });
        if (ingErr) throw ingErr;
        const ingRow = ing as TrafficIngestionStatus;
        const bmin = ymdOnly(ingRow.aggregate_day_min ?? null);
        const bmax = ymdOnly(ingRow.aggregate_day_max ?? null);
        if (bmin && bmax) {
          rpcFrom = bmin;
          rpcTo = bmax;
        } else {
          return emptyTrafficDashboard(effectiveWebId);
        }
      } else if (!rpcFrom || !rpcTo) {
        throw new Error("Rentang tanggal tidak valid.");
      }

      if (rpcFrom && rpcTo && rpcTo < rpcFrom) {
        throw new Error("Tanggal akhir harus setelah tanggal mulai.");
      }

      const { data, error } = await supabase.rpc("get_traffic_dashboard", {
        p_web_id: effectiveWebId,
        p_from: rpcFrom,
        p_to: rpcTo,
        p_top_pages_limit: 15,
        p_top_clicks_limit: 15,
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
    dateSelection,
    setDateSelection,
    filtersHydrated,
    googleCustomerId,
    webIdsQuery,
    webAccessQuery,
    effectiveWebId,
    fromDate,
    toDate,
    rangeIsMaximum,
    dashboardQuery,
    ingestionQuery,
  };
}

