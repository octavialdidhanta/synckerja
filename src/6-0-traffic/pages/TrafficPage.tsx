import React, { useEffect, useMemo, useState } from "react";
import { HeaderAndTab } from "../container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { Button } from "@/shared/components/ui/button";
import { BarChart3 } from "lucide-react";
import { UtmTrackingTable } from "../components/UtmTrackingTable";
import { computeTrafficKpiDisplay, computeUnfilteredTrafficKpiDisplay } from "../lib/computeTrafficKpiDisplay";
import {
  computeSourceBreakdownTotals,
  normalizeSourceBreakdownRows,
} from "../lib/normalizeSourceBreakdownRows";
import {
  formatTrafficSyncErrorMessage,
  parseTrafficSyncResponse,
} from "../lib/parseTrafficSyncResponse";
import { trafficDashboardErrorHint } from "../lib/trafficDashboardErrorHint";
import { EMPTY_UTM_TABLE_METRICS, type UtmTableMetricsSlice } from "../lib/utmTableMetrics";
import { supabase } from "@/shared/lib/supabaseClient";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { computePresetRange, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useTranslation } from "react-i18next";
import { ConnectWebIdDialog } from "../components/ConnectWebIdDialog";
import { TrafficWebIdSelect } from "../components/TrafficWebIdSelect";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { useToast } from "@/shared/components/ui/use-toast";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClickDetailsDialog } from "../components/ClickDetailsDialog";
import { useTrafficDashboardController } from "../hooks/useTrafficDashboardController";
import { TrafficKpiCompareHint } from "../components/TrafficKpiCompareHint";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

type TrafficDashboardPayload = {
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
    scroll_sessions?: number;
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
    row_kind?: "session" | "journey" | null;
    parent_session_id?: string | null;
    page_view_id?: string | null;
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
  /** Coarse acquisition mix; session counts sum to KPI sessions for the range. */
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

function formatDurationMsCompact(ms: number) {
  const safe = Number(ms ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return "—";

  const totalSeconds = Math.floor(safe / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatPct(v: unknown) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const clamped = Math.max(0, Math.min(100, rounded));
  return `${clamped}%`;
}

export default function TrafficPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnectingWebId, setDisconnectingWebId] = useState<string | null>(null);
  const [disconnectConfirmWebId, setDisconnectConfirmWebId] = useState<string | null>(null);
  const { data: userRole } = useCurrentUserRole();
  type TrafficClickDetails =
    | { kind: "path"; path: string }
    | { kind: "source"; key: "utm" | "paid_click_ids" | "referral" | "direct"; label: string };
  const [clickDetails, setClickDetails] = useState<TrafficClickDetails | null>(null);
  const [utmTableMetrics, setUtmTableMetrics] = useState<UtmTableMetricsSlice>(EMPTY_UTM_TABLE_METRICS);

  const {
    organizationId,
    webId,
    setWebId,
    dateSelection,
    setDateSelection,
    filtersHydrated,
    googleCustomerId,
    webIdsQuery,
    effectiveWebId,
    fromDate,
    toDate,
    rangeIsMaximum,
    queryFromDate,
    queryToDate,
    queryDateReady,
    dashboardQuery,
    dashboardCompareQuery,
    previousRange,
    ingestionQuery,
    webAccessQuery,
  } = useTrafficDashboardController();

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    googleCustomerId || null,
    Boolean(organizationId && googleCustomerId),
  );

  useEffect(() => {
    const earliest = accountDateBounds?.earliest_date;
    if (!earliest) return;
    setDateSelection((prev) => {
      if (prev.preset !== "all_time") return prev;
      const range = computePresetRange("all_time", new Date(), {
        accountEarliestYmd: earliest,
      });
      const nextFrom = range.from ? toYmdLocal(range.from) : null;
      const nextTo = range.to ? toYmdLocal(range.to) : null;
      const prevFrom = prev.range.from ? toYmdLocal(prev.range.from) : null;
      const prevTo = prev.range.to ? toYmdLocal(prev.range.to) : null;
      if (prevFrom === nextFrom && prevTo === nextTo) return prev;
      return { ...prev, range };
    });
  }, [accountDateBounds?.earliest_date, setDateSelection]);

  const calendarYearPresetYears = useMemo(
    () => buildReportYearOptionsFromEarliest(accountDateBounds?.earliest_date),
    [accountDateBounds?.earliest_date],
  );

  const accessibleWebIds = webIdsQuery.data ?? [];
  const pendingApprovalWebIds = useMemo(() => {
    return (webAccessQuery.data ?? [])
      .filter((row) => row.is_approved === false)
      .map((row) => row.web_id)
      .filter((id) => id.trim() !== "");
  }, [webAccessQuery.data]);

  const selectedWebId = useMemo(() => {
    if (webIdsQuery.isLoading || accessibleWebIds.length === 0) return "";
    const trimmed = webId.trim();
    if (trimmed && accessibleWebIds.includes(trimmed)) return trimmed;
    return accessibleWebIds[0];
  }, [webIdsQuery.isLoading, accessibleWebIds, webId]);

  const canManageWebId = userRole === "owner" || userRole === "admin";

  const disconnectConfirmIsPending = useMemo(() => {
    if (!disconnectConfirmWebId) return false;
    return (webAccessQuery.data ?? []).some(
      (row) => row.web_id === disconnectConfirmWebId && row.is_approved === false,
    );
  }, [disconnectConfirmWebId, webAccessQuery.data]);

  void organizationId;

  const kpis = dashboardQuery.data?.kpis ?? null;
  const utmRows = useMemo(() => {
    return (dashboardQuery.data?.utm_table ?? []).map((r) => ({
      ...r,
      sessions: Number(r.sessions ?? 0),
      page_views: Number(r.page_views ?? 0),
      clicks: Number(r.clicks ?? 0),
      max_deep_scroll_pct: (r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct == null
        ? null
        : Number((r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct),
      avg_max_deep_scroll_pct: (r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct == null
        ? null
        : Number((r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct),
      scroll_sessions: Number((r as { scroll_sessions?: unknown }).scroll_sessions ?? 0),
    }));
  }, [dashboardQuery.data?.utm_table]);

  const sourceBreakdownRows = useMemo(
    () => normalizeSourceBreakdownRows(dashboardQuery.data?.source_breakdown),
    [dashboardQuery.data?.source_breakdown],
  );

  const sourceBreakdownTotals = useMemo(
    () => computeSourceBreakdownTotals(sourceBreakdownRows),
    [sourceBreakdownRows],
  );

  const hasSourceBreakdown = sourceBreakdownRows.length > 0;
  const { sessionsDisplay, pageViewsDisplay, clicksDisplay } = computeTrafficKpiDisplay({
    kpis,
    utmTableMetrics,
    hasSourceBreakdown,
    sourceBreakdownTotals,
  });
  const unfilteredCurrentKpis = computeUnfilteredTrafficKpiDisplay({
    kpis,
    sourceBreakdown: dashboardQuery.data?.source_breakdown,
  });
  const unfilteredPreviousKpis = computeUnfilteredTrafficKpiDisplay({
    kpis: dashboardCompareQuery.data?.kpis ?? null,
    sourceBreakdown: dashboardCompareQuery.data?.source_breakdown,
  });
  const compareLoading = Boolean(previousRange) && dashboardCompareQuery.isPending;
  const topPages = dashboardQuery.data?.top_pages ?? [];

  const topPagesBlog = useMemo(() => {
    return topPages.filter((p) => {
      const path = String((p as { path?: unknown }).path ?? "");
      return path === "/blog" || path.startsWith("/blog/");
    });
  }, [topPages]);
  const topPagesNonBlog = useMemo(() => {
    return topPages.filter((p) => {
      const path = String((p as { path?: unknown }).path ?? "");
      return !(path === "/blog" || path.startsWith("/blog/"));
    });
  }, [topPages]);

  async function handleSync() {
    if (!effectiveWebId) return;
    if (!rangeIsMaximum && (!fromDate || !toDate)) {
      toast({
        title: "Select date range",
        description: "Pilih date range (preset atau custom) dulu untuk refresh rollup.",
        variant: "destructive",
      });
      return;
    }
    setSyncing(true);
    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionRes.session?.access_token ?? "";
      if (!token) {
        toast({
          title: "Sync failed",
          description: "Sesi login tidak ditemukan. Silakan login ulang.",
          variant: "destructive",
        });
        return;
      }

      const url = `${SUPABASE_URL}/functions/v1/traffic-refresh-rollups`;
      const body =
        rangeIsMaximum
          ? { web_id: effectiveWebId, from: null as string | null, to: null as string | null }
          : { web_id: effectiveWebId, from: fromDate, to: toDate };

      const delaysMs = [0, 600, 1500, 3000];
      let lastErr: { status: number; message: string } | null = null;

      for (let attempt = 0; attempt < delaysMs.length; attempt++) {
        if (delaysMs[attempt] > 0) {
          await new Promise((r) => setTimeout(r, delaysMs[attempt]));
        }

        const res = await fetch(url, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        const parsed = parseTrafficSyncResponse(text);

        // Edge function may return `{ success: true }` (repo) or `{ ok: true, p_from, p_to, ... }` (RPC-shaped / older deploy).
        const syncOk =
          res.ok && (parsed?.success === true || parsed?.ok === true);
        if (syncOk) {
          const desc =
            rangeIsMaximum
              ? `Rollup refreshed for ${effectiveWebId} (Maximum: semua tanggal yang tersedia).`
              : `Rollup refreshed for ${effectiveWebId} (${fromDate} → ${toDate}).`;
          toast({
            title: "Synced",
            description: desc,
          });
          void ingestionQuery.refetch();
          dashboardQuery.refetch();
          return;
        }

        // Supabase Edge Runtime can intermittently return 503 without executing the function.
        // Retry a few times before surfacing the error to the user.
        const errMsg = formatTrafficSyncErrorMessage(parsed, text);

        if (res.status === 503 && attempt < delaysMs.length - 1) {
          lastErr = { status: res.status, message: errMsg };
          continue;
        }

        lastErr = { status: res.status, message: errMsg || res.statusText };
        break;
      }

      toast({
        title: "Sync failed",
        description: lastErr ? `[${lastErr.status}] ${lastErr.message}` : "Unknown error",
        variant: "destructive",
      });
      return;
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnectWebAccess(webIdToDisconnect: string) {
    if (!organizationId) return;
    setDisconnectingWebId(webIdToDisconnect);
    try {
      const { error } = await supabase
        .from("analytics_web_access")
        .delete()
        .eq("organization_id", organizationId)
        .eq("web_id", webIdToDisconnect);
      if (error) throw error;

      if (webId.trim() === webIdToDisconnect) {
        setWebId("");
      }

      toast({
        title: "web_id disconnected",
        description: `Koneksi web_id "${webIdToDisconnect}" sudah dihapus dari organisasi ini.`,
      });
      void webAccessQuery.refetch();
      void webIdsQuery.refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus koneksi web_id.";
      toast({
        title: "Disconnect failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDisconnectingWebId(null);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="shrink-0 border-b border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">Traffic overview</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrafficWebIdSelect
                          value={selectedWebId}
                          options={accessibleWebIds}
                          loading={webIdsQuery.isLoading}
                          canDisconnect={canManageWebId}
                          disconnectingWebId={disconnectingWebId}
                          onValueChange={setWebId}
                          onConnectClick={() => setConnectOpen(true)}
                          onDisconnectClick={setDisconnectConfirmWebId}
                        />
                        {filtersHydrated ? (
                          <GoogleAdsDateRangePicker
                            value={dateSelection}
                            onChange={setDateSelection}
                            accountEarliestYmd={accountDateBounds?.earliest_date}
                            calendarYearPresetYears={calendarYearPresetYears}
                            calendarYearFilterHint={t(
                              "digitalMarketing.report.calendarYearFilterHint",
                              "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                            )}
                            allTimePopoverHint={t(
                              "digitalMarketing.traffic.allTimeRangeHint",
                              "All time uses the same date range as Report and Google Ads tabs.",
                            )}
                          />
                        ) : (
                          <div
                            className="h-9 w-[12rem] animate-pulse rounded-md bg-muted"
                            aria-hidden
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={handleSync}
                          disabled={syncing || !effectiveWebId}
                        >
                          {syncing ? "Syncing…" : "Sync data"}
                        </Button>
                        <Button size="sm" className="gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="grid grid-cols-12 gap-3">
                      {pendingApprovalWebIds.length > 0 ? (
                        <div className="col-span-12">
                          <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
                            <AlertTitle className="text-amber-950">web_id belum approved</AlertTitle>
                            <AlertDescription className="flex flex-col gap-2 text-sm text-amber-900/90">
                              <span>Data traffic belum bisa diambil sampai approval aktif.</span>
                              <span className="flex flex-wrap gap-2">
                                {pendingApprovalWebIds.map((pendingWebId) => (
                                  <span
                                    key={pendingWebId}
                                    className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white/70 px-2 py-1"
                                  >
                                    <code className="text-amber-950">{pendingWebId}</code>
                                    {canManageWebId ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 border-amber-300 px-2 text-xs text-amber-950 hover:bg-amber-100"
                                        onClick={() => setDisconnectConfirmWebId(pendingWebId)}
                                        disabled={disconnectingWebId === pendingWebId}
                                      >
                                        {disconnectingWebId === pendingWebId ? "Menghapus..." : "Hapus"}
                                      </Button>
                                    ) : null}
                                  </span>
                                ))}
                              </span>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ) : null}
                      {!ingestionQuery.isLoading &&
                        !ingestionQuery.isError &&
                        (ingestionQuery.data?.data_status === "raw_pending_rollup" ||
                          ingestionQuery.data?.data_status === "rollups_not_built") && (
                        <div className="col-span-12">
                          <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
                            <AlertTitle className="text-amber-950">Agregat dashboard sedang disiapkan</AlertTitle>
                            <AlertDescription className="text-sm text-amber-900/90">
                              Event trafik sudah masuk (API mengembalikan HTTP 201), tetapi rollup harian belum selesai.
                              Dashboard biasanya memperbarui otomatis dalam <strong>45–90 detik</strong>. Grafik harian bisa
                              sementara nol sampai rollup selesai. Jika setelah ~2 menit masih kosong, klik{" "}
                              <strong>Sync data</strong> (akun <strong>owner</strong> atau <strong>admin</strong>) untuk
                              refresh rollup manual—bukan mengirim ulang data dari website.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                      {!ingestionQuery.isLoading && !ingestionQuery.isError && ingestionQuery.data?.data_status === "no_ingested_data" && (
                        <div className="col-span-12">
                          <Alert>
                            <AlertTitle>Belum ada event trafik di database</AlertTitle>
                            <AlertDescription className="text-sm text-muted-foreground">
                              Untuk properti <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{effectiveWebId}</code>{" "}
                              belum ada data sesi, page view, atau klik. Pastikan skrip / pixel di situs publik
                              terhubung ke proyek Supabase ini dan mengirim <code className="rounded bg-muted px-1.5 py-0.5">web_id</code>{" "}
                              yang sama, lalu ulangi &quot;Sync data&quot; bila perlu.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <TrafficKpiCompareHint
                          title="Total sessions"
                          titleClassName="text-gray-500"
                          value={sessionsDisplay != null ? sessionsDisplay.toLocaleString() : "—"}
                          valueClassName="text-2xl font-bold text-gray-900"
                          current={unfilteredCurrentKpis.sessionsDisplay}
                          previous={unfilteredPreviousKpis.sessionsDisplay}
                          compareFromDate={previousRange?.fromDate}
                          compareToDate={previousRange?.toDate}
                          loading={compareLoading}
                        />
                      </div>
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <TrafficKpiCompareHint
                          title="All Page Views"
                          titleClassName="text-gray-500"
                          value={pageViewsDisplay != null ? pageViewsDisplay.toLocaleString() : "—"}
                          valueClassName="text-2xl font-bold text-gray-900"
                          current={unfilteredCurrentKpis.pageViewsDisplay}
                          previous={unfilteredPreviousKpis.pageViewsDisplay}
                          compareFromDate={previousRange?.fromDate}
                          compareToDate={previousRange?.toDate}
                          loading={compareLoading}
                        />
                      </div>
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <TrafficKpiCompareHint
                          title="Clicks"
                          titleClassName="text-gray-500"
                          value={clicksDisplay != null ? clicksDisplay.toLocaleString() : "—"}
                          valueClassName="text-2xl font-bold text-gray-900"
                          current={unfilteredCurrentKpis.clicksDisplay}
                          previous={unfilteredPreviousKpis.clicksDisplay}
                          compareFromDate={previousRange?.fromDate}
                          compareToDate={previousRange?.toDate}
                          loading={compareLoading}
                        />
                      </div>

                      <div className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">Sumber traffic</p>
                        </div>
                        <div className="grid grid-cols-12 gap-3 p-3">
                          <div className="col-span-12 lg:col-span-8 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-600">
                                <th className="w-[160px] px-4 py-2 font-medium">Sumber</th>
                                <th className="w-[90px] px-4 py-2 text-right font-medium">Sessions</th>
                                <th className="w-[90px] px-4 py-2 text-right font-medium">% of total</th>
                                <th className="w-[96px] px-4 py-2 text-right font-medium">Page views</th>
                                <th className="w-[86px] px-4 py-2 text-right font-medium">Clicks</th>
                                <th className="w-[110px] px-4 py-2 text-right font-medium">Max deep</th>
                                <th className="w-[135px] px-4 py-2 text-right font-medium">Avg max deep</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardQuery.isLoading ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                                    Memuat…
                                  </td>
                                </tr>
                              ) : dashboardQuery.isError ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                                    <p className="font-medium text-gray-700">Gagal memuat sumber traffic.</p>
                                    {(() => {
                                      const hint = trafficDashboardErrorHint(dashboardQuery.error);
                                      return hint ? (
                                        <p className="mx-auto mt-2 max-w-xl text-[11px] leading-snug text-gray-500">
                                          {hint}
                                        </p>
                                      ) : null;
                                    })()}
                                    <div className="mt-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => void dashboardQuery.refetch()}
                                      >
                                        Coba lagi
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ) : sourceBreakdownRows.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                                    —
                                  </td>
                                </tr>
                              ) : (
                                sourceBreakdownRows.map((row) => (
                                  <tr key={row.key} className="border-b border-gray-100">
                                    <td className="px-4 py-2.5 text-gray-900">
                                      {row.key === "utm"
                                        ? "UTM"
                                        : row.key === "paid_click_ids"
                                          ? "Paid ads"
                                          : row.key === "referral"
                                            ? "Referral"
                                            : row.key === "direct"
                                              ? "Direct"
                                              : row.label || row.key}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                                      {row.sessions.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                                      {sourceBreakdownTotals.sessions > 0
                                        ? `${Math.round((row.sessions / sourceBreakdownTotals.sessions) * 1000) / 10}%`
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                                      {row.page_views.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                                      <button
                                        type="button"
                                        disabled={!queryDateReady || row.clicks <= 0}
                                        onClick={() => {
                                          const key =
                                            row.key === "utm" || row.key === "paid_click_ids" || row.key === "referral" || row.key === "direct"
                                              ? row.key
                                              : "utm";
                                          const label =
                                            row.key === "utm"
                                              ? "UTM"
                                              : row.key === "paid_click_ids"
                                                ? "Paid ads"
                                                : row.key === "referral"
                                                  ? "Referral"
                                                  : row.key === "direct"
                                                    ? "Direct"
                                                    : row.label || row.key;
                                          setClickDetails({ kind: "source", key, label });
                                        }}
                                        className="w-full text-right font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                                        aria-label={`Lihat detail klik untuk ${row.label || row.key}`}
                                      >
                                        {row.clicks.toLocaleString()}
                                      </button>
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                                      {formatPct(row.max_deep_scroll_pct)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                                      {formatPct(row.avg_max_deep_scroll_pct)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            {!dashboardQuery.isLoading &&
                              !dashboardQuery.isError &&
                              sourceBreakdownRows.length > 0 && (
                                <tfoot>
                                  <tr className="bg-gray-50/80 text-xs font-medium text-gray-800">
                                    <td className="px-4 py-2">Total</td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {sourceBreakdownTotals.sessions.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">100%</td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {sourceBreakdownTotals.page_views.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {sourceBreakdownTotals.clicks.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {formatPct(sourceBreakdownTotals.max_deep_scroll_pct)}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {sourceBreakdownTotals.scroll_sessions > 0
                                        ? formatPct(sourceBreakdownTotals.scroll_sum / sourceBreakdownTotals.scroll_sessions)
                                        : "—"}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                          </table>
                          </div>
                          <div className="col-span-12 lg:col-span-4">
                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs font-medium text-gray-700">Sessions</p>
                              <div className="mt-2 h-44 w-full min-w-0">
                                {dashboardQuery.isLoading || dashboardQuery.isError || sourceBreakdownRows.length === 0 ? (
                                  <div className="h-full w-full rounded bg-white/70" aria-hidden />
                                ) : (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                      data={sourceBreakdownRows.map((r) => ({
                                        source:
                                          r.key === "utm"
                                            ? "UTM"
                                            : r.key === "paid_click_ids"
                                              ? "Paid"
                                              : r.key === "referral"
                                                ? "Ref"
                                                : r.key === "direct"
                                                  ? "Direct"
                                                  : r.key,
                                        sessions: r.sessions,
                                      }))}
                                      layout="vertical"
                                      margin={{ left: 6, right: 8, top: 0, bottom: 0 }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                                      <YAxis
                                        dataKey="source"
                                        type="category"
                                        width={44}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                      />
                                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                      <Bar dataKey="sessions" fill="hsl(204 70% 42%)" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 flex h-[480px] min-h-0 flex-col [@media(max-height:900px)]:h-[420px] [@media(max-height:760px)]:h-[380px]">
                        <UtmTrackingTable
                          rows={utmRows}
                          onUtmTableMetricsSliceChange={setUtmTableMetrics}
                          webId={effectiveWebId}
                          queryFromDate={queryFromDate}
                          queryToDate={queryToDate}
                          queryDateReady={queryDateReady}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-12 gap-3">
                      <div className="col-span-6 flex h-[420px] min-h-0 flex-col rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">Top pages</p>
                          <span className="text-xs text-gray-500">{topPagesNonBlog.length} items</span>
                        </div>
                        {topPagesNonBlog.length === 0 ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center">
                            <p className="text-xs text-gray-500">—</p>
                          </div>
                        ) : (
                          <div className="mt-3 min-h-0 flex-1">
                            <div className="scrollbar-hide nested-scroll-touch-chain h-full overflow-auto rounded-md border border-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <table className="w-full min-w-[720px] table-fixed text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="w-[260px] pb-2 pl-2 font-medium">Path</th>
                                  <th className="w-[80px] pb-2 text-right font-medium">Impr</th>
                                  <th className="w-[86px] pb-2 text-right font-medium">Sesi unik</th>
                                  <th className="w-[70px] pb-2 text-right font-medium">Klik</th>
                                  <th className="w-[110px] pb-2 text-right font-medium">Median aktif</th>
                                  <th className="w-[100px] pb-2 text-right font-medium">Rata-rata</th>
                                  <th className="w-[110px] pb-2 text-right font-medium">Max deep</th>
                                  <th className="w-[140px] pb-2 text-right font-medium">Avg max deep</th>
                                  <th className="w-[60px] pb-2 pr-4 text-right font-medium">n</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topPagesNonBlog.slice(0, 10).map((p) => (
                                  <tr key={p.path} className="border-t border-gray-100">
                                    <td className="py-2 pl-2 pr-3">
                                      <span className="block truncate text-gray-900" title={p.path}>
                                        {p.path}
                                      </span>
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.impr ?? 0).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.unique_sessions ?? 0).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.clicks ?? 0) > 0 ? (
                                        <button
                                          type="button"
                                          className="tabular-nums text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                                          disabled={!queryDateReady}
                                          onClick={() => {
                                            const raw = String(p.path ?? "").trim();
                                            setClickDetails({ kind: "path", path: raw || "/" });
                                          }}
                                        >
                                          {Number(p.clicks ?? 0).toLocaleString()}
                                        </button>
                                      ) : (
                                        Number(p.clicks ?? 0).toLocaleString()
                                      )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatDurationMsCompact(Number(p.median_active_ms ?? 0))}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatDurationMsCompact(Number(p.avg_active_ms ?? 0))}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatPct(p.max_deep_scroll_pct)}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatPct(p.avg_max_deep_scroll_pct)}
                                    </td>
                                    <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                                      {Number(p.n ?? 0).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          </div>
                        )}
                      </div>
                      <div className="col-span-6 flex h-[420px] min-h-0 flex-col rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">Top blog pages</p>
                          <span className="text-xs text-gray-500">{topPagesBlog.length} items</span>
                        </div>
                        {topPagesBlog.length === 0 ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center">
                            <p className="text-xs text-gray-500">—</p>
                          </div>
                        ) : (
                          <div className="mt-3 min-h-0 flex-1">
                            <div className="scrollbar-hide nested-scroll-touch-chain h-full overflow-auto rounded-md border border-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <table className="w-full min-w-[720px] table-fixed text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="w-[260px] pb-2 pl-2 font-medium">Path</th>
                                  <th className="w-[80px] pb-2 text-right font-medium">Impr</th>
                                  <th className="w-[86px] pb-2 text-right font-medium">Sesi unik</th>
                                  <th className="w-[70px] pb-2 text-right font-medium">Klik</th>
                                  <th className="w-[110px] pb-2 text-right font-medium">Median aktif</th>
                                  <th className="w-[100px] pb-2 text-right font-medium">Rata-rata</th>
                                  <th className="w-[110px] pb-2 text-right font-medium">Max deep</th>
                                  <th className="w-[140px] pb-2 text-right font-medium">Avg max deep</th>
                                  <th className="w-[60px] pb-2 pr-4 text-right font-medium">n</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topPagesBlog.slice(0, 10).map((p) => (
                                  <tr key={p.path} className="border-t border-gray-100">
                                    <td className="py-2 pl-2 pr-3">
                                      <span className="block truncate text-gray-900" title={p.path}>
                                        {p.path}
                                      </span>
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.impr ?? 0).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.unique_sessions ?? 0).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {Number(p.clicks ?? 0) > 0 ? (
                                        <button
                                          type="button"
                                          className="tabular-nums text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                                          disabled={!queryDateReady}
                                          onClick={() => {
                                            const raw = String(p.path ?? "").trim();
                                            setClickDetails({ kind: "path", path: raw || "/" });
                                          }}
                                        >
                                          {Number(p.clicks ?? 0).toLocaleString()}
                                        </button>
                                      ) : (
                                        Number(p.clicks ?? 0).toLocaleString()
                                      )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatDurationMsCompact(Number(p.median_active_ms ?? 0))}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatDurationMsCompact(Number(p.avg_active_ms ?? 0))}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatPct(p.max_deep_scroll_pct)}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700">
                                      {formatPct(p.avg_max_deep_scroll_pct)}
                                    </td>
                                    <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                                      {Number(p.n ?? 0).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>

      <ConnectWebIdDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        organizationId={organizationId}
        existingWebIds={webIdsQuery.data ?? []}
        onConnected={(newWebId) => {
          webIdsQuery.refetch();
          setWebId(newWebId);
        }}
        onRequestSubmitted={() => {
          void webAccessQuery.refetch();
          void webIdsQuery.refetch();
        }}
      />

      <AlertDialog
        open={disconnectConfirmWebId != null}
        onOpenChange={(open) => {
          if (!open && disconnectingWebId == null) setDisconnectConfirmWebId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disconnectConfirmIsPending ? "Hapus request web_id?" : "Disconnect web_id?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Koneksi web_id{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{disconnectConfirmWebId ?? ""}</code>{" "}
              akan dihapus dari{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">analytics_web_access</code>{" "}
              untuk organisasi ini.
              {disconnectConfirmIsPending ? (
                <>
                  {" "}
                  Request belum approved; data traffic tetap tidak bisa diambil sampai request baru dibuat dan
                  di-approved.
                </>
              ) : (
                <>
                  {" "}
                  Data trafik mentah di database tidak ikut terhapus, tetapi dashboard tidak lagi menampilkan properti
                  ini sampai Anda connect ulang.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectingWebId != null}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disconnectingWebId != null || disconnectConfirmWebId == null}
              onClick={(e) => {
                e.preventDefault();
                if (!disconnectConfirmWebId) return;
                void handleDisconnectWebAccess(disconnectConfirmWebId).then(() => {
                  setDisconnectConfirmWebId(null);
                });
              }}
            >
              {disconnectingWebId != null ? "Menghapus..." : "Hapus koneksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClickDetailsDialog
        open={clickDetails != null}
        onOpenChange={(open) => {
          if (!open) setClickDetails(null);
        }}
        webId={effectiveWebId}
        queryFromDate={queryFromDate}
        queryToDate={queryToDate}
        queryDateReady={queryDateReady}
        path={clickDetails?.kind === "path" ? clickDetails.path : clickDetails?.kind === "source" ? clickDetails.label : ""}
        sourceKey={clickDetails?.kind === "source" ? clickDetails.key : undefined}
      />
    </div>
  );
}


