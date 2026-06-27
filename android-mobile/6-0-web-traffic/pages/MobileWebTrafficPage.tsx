import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useTrafficDashboardController } from "@/6-0-traffic/hooks/useTrafficDashboardController";
import { WebTrafficNavigationFooter } from "@/mobile/6-0-web-traffic/components/WebTrafficNavigationFooter";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { supabase } from "@/shared/lib/supabaseClient";
import { MobileTrafficWebIdPicker } from "@/mobile/6-0-web-traffic/components/MobileTrafficWebIdPicker";
import { MobileSessionsBySourceCard } from "@/mobile/6-0-web-traffic/components/MobileSessionsBySourceCard";
import { MobileSourceTrafficTableCard } from "@/mobile/6-0-web-traffic/components/MobileSourceTrafficTableCard";
import { MobileUtmTrackingTable } from "@/mobile/6-0-web-traffic/components/MobileUtmTrackingTable";
import { MobileTopPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopPagesTableCard";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";
import { MobileTopBlogPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopBlogPagesTableCard";
import { MobileTrafficDateRangeDrawer } from "@/mobile/6-0-web-traffic/components/MobileTrafficDateRangeDrawer";
import { ConnectWebIdDialog } from "@/6-0-traffic/components/ConnectWebIdDialog";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { WebTrafficMobileShellHeader } from "@/mobile/6-0-web-traffic/components/WebTrafficMobileShellHeader";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import { cn } from "@/shared/lib/utils";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { useToast } from "@/shared/components/ui/use-toast";
import { computeTrafficKpiDisplay } from "@/6-0-traffic/lib/computeTrafficKpiDisplay";
import {
  computeSourceBreakdownTotals,
  normalizeSourceBreakdownRows,
} from "@/6-0-traffic/lib/normalizeSourceBreakdownRows";
import {
  formatTrafficSyncErrorMessage,
  parseTrafficSyncResponse,
} from "@/6-0-traffic/lib/parseTrafficSyncResponse";
import { trafficDashboardErrorHint } from "@/6-0-traffic/lib/trafficDashboardErrorHint";
import { EMPTY_UTM_TABLE_METRICS, type UtmTableMetricsSlice } from "@/6-0-traffic/lib/utmTableMetrics";
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { computePresetRange, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
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

function formatCompactInt(n: number | null) {
  if (n == null) return "—";
  const safe = Number(n ?? 0);
  if (!Number.isFinite(safe)) return "—";
  return safe.toLocaleString();
}

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

function MobileWebTrafficPageContent({ hasPageAccess }: { hasPageAccess: boolean }) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { data: userRole } = useCurrentUserRole();
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectingWebId, setDisconnectingWebId] = useState<string | null>(null);
  const [disconnectConfirmWebId, setDisconnectConfirmWebId] = useState<string | null>(null);
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
    webAccessQuery,
    effectiveWebId,
    fromDate,
    toDate,
    rangeIsMaximum,
    queryFromDate,
    queryToDate,
    queryDateReady,
    dashboardQuery,
    ingestionQuery,
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

  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const pullDistanceRef = useRef(0);
  type TrafficPathClickDetails = { kind: "path"; path: string };
  const [clickDetails, setClickDetails] = useState<TrafficPathClickDetails | null>(null);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const kpis = dashboardQuery.data?.kpis ?? null;
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

  const utmRows = useMemo(() => {
    return (dashboardQuery.data?.utm_table ?? []).map((r) => ({
      row_kind: (r as { row_kind?: "session" | "journey" | null }).row_kind ?? null,
      visit_key: (r as { visit_key?: string | null }).visit_key ?? null,
      visitor_id: (r as { visitor_id?: string | null }).visitor_id ?? null,
      session_id: (r as { session_id?: string | null }).session_id ?? null,
      day: (r as { day?: string | null }).day ?? null,
      occurred_at: (r as { occurred_at?: string | null }).occurred_at ?? null,
      time_label: (r as { time_label?: string | null }).time_label ?? null,
      route: (r as { route?: string | null }).route ?? null,
      utm_campaign: (r as { utm_campaign?: string | null }).utm_campaign ?? null,
      utm_source: (r as { utm_source?: string | null }).utm_source ?? null,
      utm_medium: (r as { utm_medium?: string | null }).utm_medium ?? null,
      utm_content: (r as { utm_content?: string | null }).utm_content ?? null,
      utm_term: (r as { utm_term?: string | null }).utm_term ?? null,
      page_views: Number((r as { page_views?: unknown }).page_views ?? 0),
      clicks: Number((r as { clicks?: unknown }).clicks ?? 0),
      max_deep_scroll_pct:
        (r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct == null
          ? null
          : Number((r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct),
      avg_max_deep_scroll_pct:
        (r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct == null
          ? null
          : Number((r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct),
      scroll_sessions: Number((r as { scroll_sessions?: unknown }).scroll_sessions ?? 0),
    }));
  }, [dashboardQuery.data?.utm_table]);

  const handleCustomDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      setCustomDateRange({ start: startDate, end: endDate });
      setDateSelection({
        preset: "custom",
        range: { from: startDate, to: endDate },
        rollingDays: 30,
      });
    },
    [setDateSelection],
  );

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
        variant: "headsUp",
        duration: 2800,
      });
      void webAccessQuery.refetch();
      void webIdsQuery.refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus koneksi web_id.";
      toast({
        title: "Disconnect failed",
        description: message,
        variant: "headsUp",
        duration: 3200,
      });
    } finally {
      setDisconnectingWebId(null);
    }
  }

  const syncRollups = useCallback(async () => {
    if (!effectiveWebId) return;
    if (!rangeIsMaximum && (!fromDate || !toDate)) {
      toast({
        title: "Select date range",
        description: "Pilih date range (preset atau custom) dulu untuk refresh rollup.",
        variant: "headsUp",
        duration: 3200,
      });
      return;
    }

    const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw sessionErr;
    const token = sessionRes.session?.access_token ?? "";
    if (!token) {
      toast({
        title: "Sync failed",
        description: "Sesi login tidak ditemukan. Silakan login ulang.",
        variant: "headsUp",
        duration: 2800,
      });
      return;
    }

    const url = `${SUPABASE_URL}/functions/v1/traffic-refresh-rollups`;
    const body = rangeIsMaximum
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
      const syncOk = res.ok && (parsed?.success === true || parsed?.ok === true);

      if (syncOk) {
        const desc = rangeIsMaximum
          ? `Rollup refreshed for ${effectiveWebId} (Maximum: semua tanggal yang tersedia).`
          : `Rollup refreshed for ${effectiveWebId} (${fromDate} → ${toDate}).`;
        toast({ title: "Synced", description: desc, variant: "headsUp", duration: 2200 });
        void ingestionQuery.refetch();
        await dashboardQuery.refetch();
        return;
      }

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
      variant: "headsUp",
      duration: 3200,
    });
  }, [dashboardQuery, effectiveWebId, fromDate, ingestionQuery, rangeIsMaximum, toast, toDate]);

  const handleSync = useCallback(async () => {
    if (isRefreshing || dashboardQuery.isFetching) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      if (!effectiveWebId) {
        await dashboardQuery.refetch();
        return;
      }
      await syncRollups();
    } finally {
      setIsRefreshing(false);
    }
  }, [dashboardQuery, effectiveWebId, isRefreshing, syncRollups]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    const el = listScrollRef.current;
    if (el?.scrollTop != null && el.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-horizontal-scroll-zone]")) {
        return;
      }

      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - touchStartX.current;
      const delta = y - touchStartY.current;

      if (Math.abs(dx) > Math.abs(delta)) {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }

      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing],
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      handleSync();
    }
  }, [handleSync]);

  const topPages = (dashboardQuery.data?.top_pages ?? []) as Array<{
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
  }>;

  const dashboardErrorHint = dashboardQuery.isError ? trafficDashboardErrorHint(dashboardQuery.error) : null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
        <WebTrafficMobileShellHeader
          onSync={handleSync}
          syncDisabled={dashboardQuery.isFetching || isRefreshing}
          isSyncing={isRefreshing || dashboardQuery.isFetching}
        />

        <ModuleShellContentGate
          pagePath={MOBILE_PAGE_PATH.digitalMarketingTraffic}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {hasPageAccess ? (
          <div
            ref={listScrollRef}
            className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
              style={{
                height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                minHeight: 0,
                transition: isPulling
                  ? "none"
                  : "height 0.28s ease-in-out, min-height 0.28s ease-in-out",
              }}
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
              ) : pullDistance >= PULL_THRESHOLD ? (
                <span className="text-xs font-medium text-primary whitespace-nowrap">
                  {t("common.pullToRefresh.release", "Lepas untuk sync")}
                </span>
              ) : (
                <RefreshCw
                  className="h-5 w-5 opacity-80 shrink-0"
                  style={{
                    transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                    transition: isPulling ? "none" : "transform 0.2s ease-in-out",
                  }}
                  aria-hidden
                />
              )}
            </div>
            <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-default">
              {webIdsQuery.isError ? (
                <div className="rounded-lg border border-primary/35 bg-card p-3 text-sm text-destructive">
                  {t("traffic.mobile.error.webIds", "Gagal memuat web id.")}
                </div>
              ) : null}

              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="min-w-0 w-full">
                    <MobileTrafficWebIdPicker
                      value={selectedWebId}
                      options={accessibleWebIds}
                      loading={webIdsQuery.isLoading}
                      canDisconnect={canManageWebId}
                      disconnectingWebId={disconnectingWebId}
                      onValueChange={setWebId}
                      onConnectClick={() => setConnectOpen(true)}
                      onDisconnectClick={setDisconnectConfirmWebId}
                    />
                  </div>

                  <div className="min-w-0 w-full">
                    <MobileTrafficDateRangeDrawer
                      value={dateSelection}
                      onChange={setDateSelection}
                      filtersHydrated={filtersHydrated}
                      accountEarliestYmd={accountDateBounds?.earliest_date}
                      calendarYearPresetYears={calendarYearPresetYears}
                      allTimeHint={t(
                        "digitalMarketing.traffic.allTimeRangeHint",
                        "All time uses the same date range as Report and Google Ads tabs.",
                      )}
                      calendarYearFilterHint={t(
                        "digitalMarketing.report.calendarYearFilterHint",
                        "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                      )}
                      onCustomClick={() => setShowCustomDatePicker(true)}
                    />
                  </div>
                </div>
              </div>

              {pendingApprovalWebIds.length > 0 ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-950">
                  <p className="font-semibold text-amber-950">web_id belum approved</p>
                  <p className="mt-1 text-amber-900/90">Data traffic belum bisa diambil sampai approval aktif.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                  </div>
                </div>
              ) : null}

              {dashboardQuery.isError ? (
                <div className="rounded-lg border border-primary/35 bg-card p-3 text-sm">
                  <p className="font-medium text-destructive">
                    {t("traffic.mobile.error.dashboard", "Gagal memuat dashboard.")}
                  </p>
                  {dashboardErrorHint ? (
                    <p className="mt-2 text-xs text-muted-foreground">{dashboardErrorHint}</p>
                  ) : null}
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
                </div>
              ) : null}

              {!ingestionQuery.isLoading &&
              !ingestionQuery.isError &&
              (ingestionQuery.data?.data_status === "raw_pending_rollup" ||
                ingestionQuery.data?.data_status === "rollups_not_built") ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-950">
                  <p className="font-semibold text-amber-950">Agregat dashboard sedang disiapkan</p>
                  <p className="mt-1 text-amber-900/90">
                    Event trafik sudah masuk (API mengembalikan HTTP 201), tetapi rollup harian belum selesai.
                    Dashboard biasanya memperbarui otomatis dalam <strong>45–90 detik</strong>. Grafik harian bisa
                    sementara nol sampai rollup selesai. Jika setelah ~2 menit masih kosong, klik{" "}
                    <strong>Sync data</strong> (akun <strong>owner</strong> atau <strong>admin</strong>) untuk refresh
                    rollup manual—bukan mengirim ulang data dari website.
                  </p>
                </div>
              ) : null}
              {!ingestionQuery.isLoading && !ingestionQuery.isError && ingestionQuery.data?.data_status === "no_ingested_data" ? (
                <div className="rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 text-xs text-slate-800">
                  <p className="font-semibold">Belum ada event trafik di database</p>
                  <p className="mt-1">
                    Untuk properti <code className="rounded bg-muted px-1.5 py-0.5">{effectiveWebId}</code> belum ada
                    data sesi, page view, atau klik. Pastikan skrip / pixel di situs publik terhubung ke proyek Supabase
                    ini dan mengirim <code className="rounded bg-muted px-1.5 py-0.5">web_id</code> yang sama, lalu
                    ulangi Sync bila perlu.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.sessions", "Sessions")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(sessionsDisplay)}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.pageViews", "Page views")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(pageViewsDisplay)}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.clicks", "Clicks")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(clicksDisplay)}
                  </div>
                </div>
              </div>

              <MobileSessionsBySourceCard
                rows={sourceBreakdownRows.map((r) => ({
                  key: r.key,
                  label: r.label,
                  sessions: r.sessions,
                }))}
                loading={dashboardQuery.isLoading}
              />

              <MobileUtmTrackingTable
                rows={utmRows}
                onUtmTableMetricsSliceChange={setUtmTableMetrics}
                webId={effectiveWebId}
                queryFromDate={queryFromDate}
                queryToDate={queryToDate}
                queryDateReady={queryDateReady}
              />

              <MobileSourceTrafficTableCard
                loading={dashboardQuery.isLoading}
                error={dashboardQuery.isError}
                errorDetail={dashboardQuery.error}
                onRetry={() => void dashboardQuery.refetch()}
                rows={sourceBreakdownRows}
                webId={effectiveWebId}
                queryFromDate={queryFromDate}
                queryToDate={queryToDate}
                queryDateReady={queryDateReady}
              />

              <MobileTopPagesTableCard
                rows={topPages}
                queryDateReady={queryDateReady}
                onClickClicks={(path) => {
                  const raw = String(path ?? "").trim();
                  setClickDetails({ kind: "path", path: raw || "/" });
                }}
              />

              <MobileTopBlogPagesTableCard
                rows={topPages}
                queryDateReady={queryDateReady}
                onClickClicks={(path) => {
                  const raw = String(path ?? "").trim();
                  setClickDetails({ kind: "path", path: raw || "/" });
                }}
              />
            </div>
          </div>
          ) : null}
        </ModuleShellContentGate>

        <CustomDatePicker
          isOpen={showCustomDatePicker}
          onClose={() => setShowCustomDatePicker(false)}
          onDateRangeSelect={handleCustomDateRange}
          initialStartDate={customDateRange?.start}
          initialEndDate={customDateRange?.end}
        />

        {!isKeyboardShellOpen ? (
          <WebTrafficNavigationFooter className="safe-area-bottom-lower" />
        ) : null}
        </main>
      </div>

      <ConnectWebIdDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        organizationId={organizationId}
        existingWebIds={accessibleWebIds}
        onConnected={(newWebId) => {
          void webIdsQuery.refetch();
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

      <MobileClickDetailsDialog
        open={clickDetails != null}
        onOpenChange={(open) => {
          if (!open) setClickDetails(null);
        }}
        webId={effectiveWebId}
        queryFromDate={queryFromDate}
        queryToDate={queryToDate}
        queryDateReady={queryDateReady}
        path={clickDetails?.path ?? ""}
      />
    </SidebarProvider>
  );
}

export default function MobileWebTrafficPage() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingTraffic;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  if (showDenyShellHeader) {
    return (
      <SidebarProvider>
        <div className={cn(outerShellClassName, "bg-muted/70")}>
          <AppSidebar />
          <main
            className={cn(
              "z-0 flex w-full min-w-0 max-w-none flex-col bg-muted/70",
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            <WebTrafficMobileShellHeader />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-default"
            />
            {!isKeyboardShellOpen ? (
              <WebTrafficNavigationFooter className="safe-area-bottom-lower" />
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return <MobileWebTrafficPageContent hasPageAccess={hasPageAccess} />;
}
