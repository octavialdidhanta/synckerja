import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useTrafficDashboardController } from "@/6-0-traffic/hooks/useTrafficDashboardController";
import { WebTrafficNavigationFooter } from "@/mobile/6-0-web-traffic/components/WebTrafficNavigationFooter";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { supabase } from "@/shared/lib/supabaseClient";
import { WebIdPicker } from "@/mobile/6-0-web-traffic/components/WebIdPicker";
import { MobileSessionsBySourceCard } from "@/mobile/6-0-web-traffic/components/MobileSessionsBySourceCard";
import { MobileSourceTrafficTableCard } from "@/mobile/6-0-web-traffic/components/MobileSourceTrafficTableCard";
import { MobileUtmTrackingTable } from "@/mobile/6-0-web-traffic/components/MobileUtmTrackingTable";
import { MobileTopPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopPagesTableCard";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";
import { MobileTopBlogPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopBlogPagesTableCard";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { useToast } from "@/shared/components/ui/use-toast";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import { ChevronDown } from "lucide-react";
import { getTodayDateRange } from "@/5-3-dashboard/components/leads/filters/dateRangePresets";
import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";

function formatCompactInt(n: number) {
  const safe = Number(n ?? 0);
  if (!Number.isFinite(safe)) return "0";
  return safe.toLocaleString();
}

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

type TrafficSyncResponseBody = {
  success?: unknown;
  ok?: unknown;
  error?: unknown;
  message?: unknown;
};

export default function MobileWebTrafficPage() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const {
    webId,
    setWebId,
    setRange,
    webIdsQuery,
    effectiveWebId,
    dashboardQuery,
    ingestionQuery,
    fromDate,
    toDate,
    rangeIsMaximum,
  } = useTrafficDashboardController(() => getTodayDateRange());

  const [dateFilter, setDateFilter] = useState<
    "maximum" | "last_30" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"
  >("today");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const pullDistanceRef = useRef(0);
  type TrafficPathClickDetails = { kind: "path"; path: string };
  const [clickDetails, setClickDetails] = useState<TrafficPathClickDetails | null>(null);

  const trafficFilterSkipsAggregates = useMemo(() => {
    if (rangeIsMaximum) return false;
    if (!fromDate || !toDate) return false;
    const ing = ingestionQuery.data;
    const dmin = ing?.aggregate_day_min;
    const dmax = ing?.aggregate_day_max;
    if (dmin == null || dmax == null || String(dmin) === "" || String(dmax) === "") return false;
    if (ing?.daily_rollups_exist === false) return false;
    const a = (v: string | null | undefined) => String(v ?? "").slice(0, 10);
    const bmin = a(dmin);
    const bmax = a(dmax);
    if (bmin.length < 10 || bmax.length < 10) return false;
    return toDate < bmin || fromDate > bmax;
  }, [rangeIsMaximum, fromDate, toDate, ingestionQuery.data]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  // Default Web ID: prefer "vialdi wedding" when available (otherwise first option).
  useEffect(() => {
    if (webId.trim()) return;
    const options = webIdsQuery.data ?? [];
    if (options.length === 0) return;
    const preferred =
      options.find((v) => String(v).toLowerCase().includes("vialdi wedding")) ?? options[0];
    setWebId(preferred);
  }, [setWebId, webId, webIdsQuery.data]);

  const applyDateFilter = useCallback(
    (value: typeof dateFilter) => {
      const now = new Date();
      if (value === "custom") {
        setShowCustomDatePicker(true);
        return;
      }

      setDateFilter(value);

      if (value === "maximum") {
        setCustomDateRange(null);
        setRange(null);
        return;
      }

      const range = (() => {
        switch (value) {
          case "last_30":
            return getLast30DaysDateRange(now);
          case "today":
            return { from: startOfDay(now), to: endOfDay(now) };
          case "yesterday": {
            const y = subDays(now, 1);
            return { from: startOfDay(y), to: endOfDay(y) };
          }
          case "this_week":
            return {
              from: startOfWeek(now, { weekStartsOn: 1 }),
              to: endOfWeek(now, { weekStartsOn: 1 }),
            };
          case "this_month":
            return { from: startOfMonth(now), to: endOfMonth(now) };
          case "last_month": {
            const lm = subMonths(now, 1);
            return { from: startOfMonth(lm), to: endOfMonth(lm) };
          }
          default:
            return { from: undefined, to: undefined };
        }
      })();

      setCustomDateRange(null);
      setRange(range.from && range.to ? range : null);
    },
    [setRange],
  );

  const handleCustomDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      setCustomDateRange({ start: startDate, end: endDate });
      setDateFilter("custom");
      setRange({ from: startDate, to: endDate });
    },
    [setRange],
  );

  const periodLabel = (() => {
    if (dateFilter === "maximum") return t("traffic.mobile.dateRange.maximumShort", "Maximum");
    if (dateFilter === "last_30") return t("reports.dateFilter.last30Days", "Last 30 days");
    if (dateFilter === "today") return t("reports.dateFilter.today", "Today");
    if (dateFilter === "yesterday") return t("reports.dateFilter.yesterday", "Yesterday");
    if (dateFilter === "this_week") return t("reports.dateFilter.thisWeek", "This Week");
    if (dateFilter === "this_month") return t("reports.dateFilter.thisMonth", "This Month");
    if (dateFilter === "last_month") return t("reports.dateFilter.lastMonth", "Last Month");
    if (dateFilter === "custom") return t("reports.dateFilter.custom", "Custom");
    return t("traffic.mobile.dateRange.maximumShort", "Maximum");
  })();

  const syncRollups = useCallback(async () => {
    if (!effectiveWebId) return;
    if (!rangeIsMaximum && (!fromDate || !toDate)) {
      toast({
        title: "Select date range",
        description: "Pilih date range (preset atau custom) dulu untuk refresh rollup.",
        variant: "destructive",
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
      let parsed: TrafficSyncResponseBody | null = null;
      try {
        const raw: unknown = text ? JSON.parse(text) : null;
        parsed = raw && typeof raw === "object" ? (raw as TrafficSyncResponseBody) : null;
      } catch {
        parsed = null;
      }

      if (res.ok && (parsed?.success === true || parsed?.ok === true)) {
        const desc = rangeIsMaximum
          ? `Rollup refreshed for ${effectiveWebId} (Maximum: semua tanggal yang tersedia).`
          : `Rollup refreshed for ${effectiveWebId} (${fromDate} → ${toDate}).`;
        toast({ title: "Synced", description: desc, variant: "headsUp", duration: 2200 });
        void ingestionQuery.refetch();
        await dashboardQuery.refetch();
        return;
      }

      if (res.status === 503 && attempt < delaysMs.length - 1) {
        lastErr = { status: res.status, message: String(parsed?.error ?? parsed?.message ?? text ?? "Edge runtime error") };
        continue;
      }

      lastErr = { status: res.status, message: String(parsed?.error ?? parsed?.message ?? text ?? res.statusText) };
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

      // Allow horizontal swipes inside horizontal-scroll zones (tables) to work.
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

      // If gesture is mostly horizontal, do not treat it as pull-to-refresh.
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight text-foreground">
                {t("traffic.page.title", "Web Traffic")}
              </h1>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={t("common.refresh", "Refresh")}
            onClick={handleSync}
            disabled={dashboardQuery.isFetching || isRefreshing}
          >
            {isRefreshing || dashboardQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                      <WebIdPicker
                        value={effectiveWebId}
                        onChange={setWebId}
                        options={webIdsQuery.data ?? []}
                        disabled={webIdsQuery.isLoading}
                        aria-label={t("traffic.mobile.webId", "Web ID")}
                      />
                    </div>
                  </div>

                  <div className="h-6 w-px shrink-0 bg-border" aria-hidden />

                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                            className="h-8 w-full text-xs gap-2 justify-between"
                          aria-label={t("traffic.mobile.dateRange", "Tanggal")}
                        >
                          {periodLabel}
                          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[80dvh]">
                        <DrawerHeader className="text-left safe-area-top pb-2">
                          <DrawerTitle>{t("traffic.mobile.dateRange", "Tanggal")}</DrawerTitle>
                        </DrawerHeader>
                        <div className="px-4 pb-4">
                          <div className="grid gap-2">
                            {(
                              [
                                { value: "maximum", label: t("traffic.mobile.dateRange.maximumShort", "Maximum") },
                                { value: "last_30", label: t("reports.dateFilter.last30Days", "Last 30 days") },
                                { value: "today", label: t("reports.dateFilter.today", "Today") },
                                { value: "yesterday", label: t("reports.dateFilter.yesterday", "Yesterday") },
                                { value: "this_week", label: t("reports.dateFilter.thisWeek", "This Week") },
                                { value: "this_month", label: t("reports.dateFilter.thisMonth", "This Month") },
                                { value: "last_month", label: t("reports.dateFilter.lastMonth", "Last Month") },
                                { value: "custom", label: t("reports.dateFilter.custom", "Custom") },
                              ] as Array<{ value: typeof dateFilter; label: string }>
                            ).map((opt) => (
                              <DrawerClose asChild key={opt.value}>
                                <Button
                                  type="button"
                                  variant={dateFilter === opt.value ? "default" : "outline"}
                                  className="justify-between"
                                  onClick={() => {
                                    applyDateFilter(opt.value);
                                  }}
                                >
                                  <span className="text-sm">{opt.label}</span>
                                </Button>
                              </DrawerClose>
                            ))}
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </div>
                </div>
              </div>

              {dashboardQuery.isError ? (
                <div className="rounded-lg border border-primary/35 bg-card p-3 text-sm text-destructive">
                  {t("traffic.mobile.error.dashboard", "Gagal memuat dashboard.")}
                </div>
              ) : null}

              {!ingestionQuery.isLoading && !ingestionQuery.isError && ingestionQuery.data?.data_status === "rollups_not_built" ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-950">
                  {t(
                    "traffic.mobile.hintRollups",
                    "Event trafik ada di database, tetapi agregat belum. Tarik ke bawah refresh atau buka Sync/refresh rollup (owner/admin) dari desktop.",
                  )}
                </div>
              ) : null}
              {!ingestionQuery.isLoading && !ingestionQuery.isError && ingestionQuery.data?.data_status === "no_ingested_data" ? (
                <div className="rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 text-xs text-slate-800">
                  {t(
                    "traffic.mobile.hintNoRaw",
                    "Belum ada sesi / page view / klik tercatat. Pastikan pixel di situs terhubung ke proyek ini dan web_id cocok, lalu sync bila perlu.",
                  )}
                </div>
              ) : null}
              {!ingestionQuery.isLoading && !ingestionQuery.isError && trafficFilterSkipsAggregates ? (
                <div className="rounded-lg border border-rose-200/80 bg-rose-50/90 p-3 text-xs text-rose-950">
                  <p className="font-semibold text-rose-950">
                    {t("traffic.mobile.hintDateFilterTitle", "Filter tanggal tidak memotong agregat harian")}
                  </p>
                  <p className="mt-1 text-rose-900/90">
                    {t(
                      "traffic.mobile.hintDateFilterSkipsAggregates",
                      "Dashboard memakai tabel agregat harian. Untuk {{web}}, hari agregat tersedia {{min}} s/d {{max}} (kalender WIB / Asia/Jakarta, kolom day). Perluas rentang atau pilih Maximum.",
                      {
                        web: effectiveWebId,
                        min: String(ingestionQuery.data?.aggregate_day_min ?? ""),
                        max: String(ingestionQuery.data?.aggregate_day_max ?? ""),
                      },
                    )}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.sessions", "Sessions")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(dashboardQuery.data?.kpis.sessions ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.pageViews", "Page views")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(dashboardQuery.data?.kpis.page_views ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/35 bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.clicks", "Clicks")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(dashboardQuery.data?.kpis.clicks ?? 0)}
                  </div>
                </div>
              </div>

              <MobileSessionsBySourceCard
                rows={(dashboardQuery.data?.source_breakdown ?? []).map((r) => ({
                  key: String((r as { key?: unknown }).key ?? ""),
                  label: String((r as { label?: unknown }).label ?? ""),
                  sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
                }))}
                loading={dashboardQuery.isLoading}
              />

              <MobileUtmTrackingTable
                rows={(dashboardQuery.data?.utm_table ?? []).map((r) => ({
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
                  max_deep_scroll_pct: (r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct == null
                    ? null
                    : Number((r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct),
                  avg_max_deep_scroll_pct: (r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct == null
                    ? null
                    : Number((r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct),
                  scroll_sessions: Number((r as { scroll_sessions?: unknown }).scroll_sessions ?? 0),
                }))}
                webId={effectiveWebId}
                fromDate={fromDate}
                toDate={toDate}
                rangeIsMaximum={rangeIsMaximum}
              />

              <MobileSourceTrafficTableCard
                loading={dashboardQuery.isLoading}
                error={dashboardQuery.isError}
                rows={(dashboardQuery.data?.source_breakdown ?? []).map((r) => ({
                  key: String((r as { key?: unknown }).key ?? ""),
                  label: String((r as { label?: unknown }).label ?? ""),
                  sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
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
                }))}
                webId={effectiveWebId}
                fromDate={fromDate}
                toDate={toDate}
                rangeIsMaximum={rangeIsMaximum}
              />

              <MobileTopPagesTableCard
                rows={topPages}
                onClickClicks={(path) => {
                  const raw = String(path ?? "").trim();
                  setClickDetails({ kind: "path", path: raw || "/" });
                }}
              />

              <MobileTopBlogPagesTableCard
                rows={topPages}
                onClickClicks={(path) => {
                  const raw = String(path ?? "").trim();
                  setClickDetails({ kind: "path", path: raw || "/" });
                }}
              />
            </div>
          </div>
        </div>

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

      <MobileClickDetailsDialog
        open={clickDetails != null}
        onOpenChange={(open) => {
          if (!open) setClickDetails(null);
        }}
        webId={effectiveWebId}
        fromDate={fromDate}
        toDate={toDate}
        rangeIsMaximum={rangeIsMaximum}
        path={clickDetails?.path ?? ""}
      />
    </SidebarProvider>
  );
}

