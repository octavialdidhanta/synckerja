import React, { useMemo, useState } from "react";
import { HeaderAndTab } from "../container/HeaderAndTab";
import { Button } from "@/shared/components/ui/button";
import { BarChart3 } from "lucide-react";
import { UtmTrackingTable, type UtmTableMetricsSlice } from "../components/UtmTrackingTable";
import { supabase } from "@/shared/lib/supabaseClient";
import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/5-3-dashboard/components/leads/filters/DateRangeFilter";
import { ConnectWebIdDialog } from "../components/ConnectWebIdDialog";
import { useToast } from "@/shared/components/ui/use-toast";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClickDetailsDialog } from "../components/ClickDetailsDialog";
import { useTrafficDashboardController } from "../hooks/useTrafficDashboardController";

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
  }>;
  funnel: { sessions: number; page_views: number; clicks: number };
  /** Coarse acquisition mix; session counts sum to KPI sessions for the range. */
  source_breakdown?: Array<{
    key: string;
    label: string;
    sessions: number;
    page_views: number;
    clicks: number;
  }>;
};

/** Sentinel `<select>` value: opens Connect dialog, not a real web_id. */
const CONNECT_WEB_ID_SELECT_VALUE = "__connect_web_id__";

function formatDurationMsCompact(ms: number) {
  const safe = Number(ms ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return "—";

  const totalSeconds = Math.floor(safe / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function TrafficPage() {
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clickDetailsOpen, setClickDetailsOpen] = useState(false);
  const [clickDetailsPath, setClickDetailsPath] = useState<string>("");
  const [sourceClickDetailsOpen, setSourceClickDetailsOpen] = useState(false);
  const [sourceClickKey, setSourceClickKey] = useState<"utm" | "paid_click_ids" | "referral" | "direct">("utm");
  const [sourceClickLabel, setSourceClickLabel] = useState<string>("UTM");
  const [utmTableMetrics, setUtmTableMetrics] = useState<UtmTableMetricsSlice>({
    utmFiltersActive: false,
    filteredSessionsSum: 0,
    filteredPageViewsSum: 0,
    filteredClicksSum: 0,
  });

  const {
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
  } = useTrafficDashboardController();

  const accessibleWebIds = webIdsQuery.data ?? [];

  const webIdSelectValue = useMemo(() => {
    if (webIdsQuery.isLoading) return "";
    if (accessibleWebIds.length === 0) return CONNECT_WEB_ID_SELECT_VALUE;
    return webId.trim() || accessibleWebIds[0];
  }, [webIdsQuery.isLoading, accessibleWebIds, webId]);

  function handleWebIdSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === CONNECT_WEB_ID_SELECT_VALUE) {
      setConnectOpen(true);
      return;
    }
    setWebId(v);
  }

  void organizationId;

  const kpis = dashboardQuery.data?.kpis ?? null;
  const utmRows = useMemo(() => {
    return (dashboardQuery.data?.utm_table ?? []).map((r) => ({
      ...r,
      sessions: Number(r.sessions ?? 0),
      page_views: Number(r.page_views ?? 0),
      clicks: Number(r.clicks ?? 0),
    }));
  }, [dashboardQuery.data?.utm_table]);

  const sourceBreakdownRows = useMemo(() => {
    const raw = dashboardQuery.data?.source_breakdown;
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({
      key: String((r as { key?: unknown }).key ?? ""),
      label: String((r as { label?: unknown }).label ?? ""),
      sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
      page_views: Number((r as { page_views?: unknown }).page_views ?? 0),
      clicks: Number((r as { clicks?: unknown }).clicks ?? 0),
    }));
  }, [dashboardQuery.data?.source_breakdown]);

  const sourceBreakdownTotals = useMemo(() => {
    return sourceBreakdownRows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        page_views: acc.page_views + r.page_views,
        clicks: acc.clicks + r.clicks,
      }),
      { sessions: 0, page_views: 0, clicks: 0 },
    );
  }, [sourceBreakdownRows]);

  const sessionsDisplay =
    kpis == null ? null : utmTableMetrics.utmFiltersActive ? utmTableMetrics.filteredSessionsSum : kpis.sessions;
  const pageViewsDisplay =
    kpis == null ? null : utmTableMetrics.utmFiltersActive ? utmTableMetrics.filteredPageViewsSum : kpis.page_views;
  const clicksDisplay =
    kpis == null ? null : utmTableMetrics.utmFiltersActive ? utmTableMetrics.filteredClicksSum : kpis.clicks;
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
    if (range !== null && (!fromDate || !toDate)) {
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
        range === null
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
        let parsed: any = null;
        try {
          parsed = text ? (JSON.parse(text) as any) : null;
        } catch {
          parsed = null;
        }

        if (res.ok && parsed?.success) {
          const desc =
            range === null
              ? `Rollup refreshed for ${effectiveWebId} (Maximum: semua tanggal yang tersedia).`
              : `Rollup refreshed for ${effectiveWebId} (${fromDate} → ${toDate}).`;
          toast({
            title: "Synced",
            description: desc,
          });
          dashboardQuery.refetch();
          return;
        }

        // Supabase Edge Runtime can intermittently return 503 without executing the function.
        // Retry a few times before surfacing the error to the user.
        if (res.status === 503 && attempt < delaysMs.length - 1) {
          lastErr = { status: res.status, message: parsed?.error ?? text ?? "Edge runtime error" };
          continue;
        }

        lastErr = { status: res.status, message: parsed?.error ?? text ?? res.statusText };
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

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="shrink-0 border-b border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">Traffic overview</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="web_id"
                          className="h-8 min-w-[10rem] max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={webIdSelectValue}
                          onChange={handleWebIdSelectChange}
                          disabled={webIdsQuery.isLoading}
                        >
                          {webIdsQuery.isLoading ? (
                            <option value="">Memuat…</option>
                          ) : accessibleWebIds.length === 0 ? (
                            <option value={CONNECT_WEB_ID_SELECT_VALUE}>Connect web_id</option>
                          ) : (
                            <>
                              {accessibleWebIds.map((id) => (
                                <option key={id} value={id}>
                                  {id}
                                </option>
                              ))}
                              <option value={CONNECT_WEB_ID_SELECT_VALUE}>Connect web_id</option>
                            </>
                          )}
                        </select>
                        <DateRangeFilter onDateRangeChange={setRange} className="w-auto" />
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
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">Total sessions</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {sessionsDisplay != null ? sessionsDisplay.toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">All Page Views</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {pageViewsDisplay != null ? pageViewsDisplay.toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="col-span-12 lg:col-span-4 rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">Clicks</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {clicksDisplay != null ? clicksDisplay.toLocaleString() : "—"}
                        </p>
                      </div>

                      <div className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">Sumber traffic</p>
                        </div>
                        <div className="grid grid-cols-12 gap-3 p-3">
                          <div className="col-span-12 lg:col-span-8 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-600">
                                <th className="px-4 py-2 font-medium">Sumber</th>
                                <th className="px-4 py-2 text-right font-medium">Sessions</th>
                                <th className="px-4 py-2 text-right font-medium">% of total</th>
                                <th className="px-4 py-2 text-right font-medium">Page views</th>
                                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardQuery.isLoading ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                                    Memuat…
                                  </td>
                                </tr>
                              ) : dashboardQuery.isError ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                                    Gagal memuat sumber traffic.
                                  </td>
                                </tr>
                              ) : sourceBreakdownRows.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
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
                                        onClick={() => {
                                          const key =
                                            row.key === "utm" || row.key === "paid_click_ids" || row.key === "referral" || row.key === "direct"
                                              ? row.key
                                              : "utm";
                                          setSourceClickKey(key);
                                          setSourceClickLabel(
                                            row.key === "utm"
                                              ? "UTM"
                                              : row.key === "paid_click_ids"
                                                ? "Paid ads"
                                                : row.key === "referral"
                                                  ? "Referral"
                                                  : row.key === "direct"
                                                    ? "Direct"
                                                    : row.label || row.key,
                                          );
                                          setSourceClickDetailsOpen(true);
                                        }}
                                        className="w-full text-right font-semibold text-primary hover:underline"
                                        aria-label={`Lihat detail klik untuk ${row.label || row.key}`}
                                      >
                                        {row.clicks.toLocaleString()}
                                      </button>
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

                      <ClickDetailsDialog
                        open={sourceClickDetailsOpen}
                        onOpenChange={(open) => {
                          setSourceClickDetailsOpen(open);
                        }}
                        webId={effectiveWebId}
                        fromDate={fromDate}
                        toDate={toDate}
                        rangeIsMaximum={rangeIsMaximum}
                        path={sourceClickLabel}
                        sourceKey={sourceClickKey}
                      />

                      <div className="col-span-12 min-h-0">
                        <UtmTrackingTable
                          rows={utmRows}
                          onUtmTableMetricsSliceChange={setUtmTableMetrics}
                          webId={effectiveWebId}
                          fromDate={fromDate}
                          toDate={toDate}
                          rangeIsMaximum={rangeIsMaximum}
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
                                          className="tabular-nums text-blue-600 hover:underline"
                                          onClick={() => {
                                            setClickDetailsPath(String(p.path ?? ""));
                                            setClickDetailsOpen(true);
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
                                          className="tabular-nums text-blue-600 hover:underline"
                                          onClick={() => {
                                            setClickDetailsPath(String(p.path ?? ""));
                                            setClickDetailsOpen(true);
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

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
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
      />

      <ClickDetailsDialog
        open={clickDetailsOpen}
        onOpenChange={(open) => {
          setClickDetailsOpen(open);
          if (!open) setClickDetailsPath("");
        }}
        webId={effectiveWebId}
        fromDate={fromDate}
        toDate={toDate}
        rangeIsMaximum={range === null}
        path={clickDetailsPath}
      />
    </div>
  );
}


