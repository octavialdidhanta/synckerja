import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useTrafficDashboardController } from "@/6-0-traffic/hooks/useTrafficDashboardController";
import { WebTrafficNavigationFooter } from "@/mobile/6-0-web-traffic/components/WebTrafficNavigationFooter";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { WebIdPicker } from "@/mobile/6-0-web-traffic/components/WebIdPicker";
import { MobileSessionsBySourceCard } from "@/mobile/6-0-web-traffic/components/MobileSessionsBySourceCard";
import { MobileSourceTrafficTableCard } from "@/mobile/6-0-web-traffic/components/MobileSourceTrafficTableCard";
import { MobileUtmTrackingTable } from "@/mobile/6-0-web-traffic/components/MobileUtmTrackingTable";
import { MobileTopPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopPagesTableCard";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";
import { MobileTopBlogPagesTableCard } from "@/mobile/6-0-web-traffic/components/MobileTopBlogPagesTableCard";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import { ChevronDown } from "lucide-react";
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

export default function MobileWebTrafficPage() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const {
    webId,
    setWebId,
    setRange,
    webIdsQuery,
    effectiveWebId,
    dashboardQuery,
    fromDate,
    toDate,
    rangeIsMaximum,
  } = useTrafficDashboardController();

  const [dateFilter, setDateFilter] = useState<
    "maximum" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"
  >("maximum");
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
  const [clickDetailsOpen, setClickDetailsOpen] = useState(false);
  const [clickDetailsPath, setClickDetailsPath] = useState<string>("");

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
    if (dateFilter === "today") return t("reports.dateFilter.today", "Today");
    if (dateFilter === "yesterday") return t("reports.dateFilter.yesterday", "Yesterday");
    if (dateFilter === "this_week") return t("reports.dateFilter.thisWeek", "This Week");
    if (dateFilter === "this_month") return t("reports.dateFilter.thisMonth", "This Month");
    if (dateFilter === "last_month") return t("reports.dateFilter.lastMonth", "Last Month");
    if (dateFilter === "custom") return t("reports.dateFilter.custom", "Custom");
    return t("traffic.mobile.dateRange.maximumShort", "Maximum");
  })();

  const syncRollups = useCallback(async () => {
    if (!effectiveWebId) {
      await dashboardQuery.refetch();
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/traffic-refresh-rollups`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        web_id: effectiveWebId,
        from: rangeIsMaximum ? null : fromDate,
        to: rangeIsMaximum ? null : toDate,
      }),
    });

    if (!res.ok) {
      // Fallback: still refetch dashboard so user sees latest cached rollups if any.
      await dashboardQuery.refetch();
      return;
    }

    await dashboardQuery.refetch();
  }, [dashboardQuery, effectiveWebId, fromDate, rangeIsMaximum, toDate]);

  const handleSync = useCallback(async () => {
    if (isRefreshing || dashboardQuery.isFetching) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await syncRollups();
    } finally {
      setIsRefreshing(false);
    }
  }, [dashboardQuery.isFetching, isRefreshing, syncRollups]);

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
  }>;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-background" style={mainFixedStyle}>
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
                <div className="rounded-lg border border-border bg-card p-3 text-sm text-destructive">
                  {t("traffic.mobile.error.webIds", "Gagal memuat web id.")}
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-card p-3">
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
                <div className="rounded-lg border border-border bg-card p-3 text-sm text-destructive">
                  {t("traffic.mobile.error.dashboard", "Gagal memuat dashboard.")}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.sessions", "Sessions")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(dashboardQuery.data?.kpis.sessions ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">{t("traffic.kpi.pageViews", "Page views")}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatCompactInt(dashboardQuery.data?.kpis.page_views ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
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

              <MobileSourceTrafficTableCard
                loading={dashboardQuery.isLoading}
                error={dashboardQuery.isError}
                rows={(dashboardQuery.data?.source_breakdown ?? []).map((r) => ({
                  key: String((r as { key?: unknown }).key ?? ""),
                  label: String((r as { label?: unknown }).label ?? ""),
                  sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
                  page_views: Number((r as { page_views?: unknown }).page_views ?? 0),
                  clicks: Number((r as { clicks?: unknown }).clicks ?? 0),
                }))}
                webId={effectiveWebId}
                fromDate={fromDate}
                toDate={toDate}
                rangeIsMaximum={rangeIsMaximum}
              />

              <MobileUtmTrackingTable
                rows={(dashboardQuery.data?.utm_table ?? []).map((r) => ({
                  route: (r as { route?: string | null }).route ?? null,
                  utm_campaign: (r as { utm_campaign?: string | null }).utm_campaign ?? null,
                  utm_source: (r as { utm_source?: string | null }).utm_source ?? null,
                  utm_medium: (r as { utm_medium?: string | null }).utm_medium ?? null,
                  utm_content: (r as { utm_content?: string | null }).utm_content ?? null,
                  utm_term: (r as { utm_term?: string | null }).utm_term ?? null,
                  sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
                  page_views: Number((r as { page_views?: unknown }).page_views ?? 0),
                  clicks: Number((r as { clicks?: unknown }).clicks ?? 0),
                }))}
                webId={effectiveWebId}
                fromDate={fromDate}
                toDate={toDate}
                rangeIsMaximum={rangeIsMaximum}
              />

              <MobileTopPagesTableCard
                rows={topPages}
                onClickClicks={(path) => {
                  setClickDetailsPath(path);
                  setClickDetailsOpen(true);
                }}
              />

              <MobileTopBlogPagesTableCard
                rows={topPages}
                onClickClicks={(path) => {
                  setClickDetailsPath(path);
                  setClickDetailsOpen(true);
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
        open={clickDetailsOpen}
        onOpenChange={(open) => {
          setClickDetailsOpen(open);
          if (!open) setClickDetailsPath("");
        }}
        webId={effectiveWebId}
        fromDate={fromDate}
        toDate={toDate}
        rangeIsMaximum={rangeIsMaximum}
        path={clickDetailsPath}
      />
    </SidebarProvider>
  );
}

