import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { IncomeBottomTabs } from "@/mobile/3-incomes/shared/IncomeBottomTabs";
import { IncomeDashboardRefreshContext } from "@/mobile/3-dashboard/IncomeDashboardRefreshContext";
import { cn } from "@/shared/lib/utils";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";

/**
 * Shared fixed-viewport mobile shell for `/incomes/*` routes (dashboard, transaction, bank).
 * Layout per android-mobile/rules/mobile-tools-layout-android.mdc (selaras `MobileExpensesShell` / Schedule / Home).
 */
const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

export type MobileIncomesShellProps = {
  title: string;
  subtitle: string;
  pagePath: string;
  children: ReactNode;
  /**
   * Hanya untuk route yang perlu kolom konten mengisi tinggi viewport di atas tab (mis. daftar bank sedikit).
   * Default `false` agar dashboard / transaction tidak berubah.
   */
  stretchScrollContent?: boolean;
};

export function MobileIncomesShell({
  title,
  subtitle,
  pagePath,
  children,
  stretchScrollContent = false,
}: MobileIncomesShellProps) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const refetchRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const refetch = refetchRef.current;
    if (!refetch) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      // eslint-disable-next-line no-console
      console.warn("[incomes][pull-to-refresh] refetch failed");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const delta = e.touches[0].clientY - touchStartY.current;
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
    if (d >= PULL_THRESHOLD) void handlePullRefresh();
  }, [handlePullRefresh]);

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <main
            className="fixed inset-x-0 z-0 flex flex-col bg-background"
            style={mainFixedStyle}
          >
            <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </div>
              <div />
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={listScrollRef}
                className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                aria-label={t("incomes.scrollArea", "Income content")}
              >
                {/*
                  `min-h-full` (tanpa `flex-1` di kolom ini): jika `flex-1` + `padding-bottom` pada anak,
                  tinggi kolom terkunci ke viewport dan konten panjang bisa menimpa padding bawah — scroll
                  tidak cukup jauh di atas tab `fixed`. Jarak ke tab = `content-padding-above-nav-default`.
                */}
                <div className="flex min-h-full min-w-0 shrink-0 flex-col">
                <div
                  className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
                  style={{
                    height:
                      pullDistance > 0
                        ? Math.min(pullDistance, MAX_PULL)
                        : isRefreshing
                          ? INDICATOR_HEIGHT
                          : 0,
                    minHeight: 0,
                    transition: isPulling
                      ? "none"
                      : "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : pullDistance >= PULL_THRESHOLD ? (
                    <span className="whitespace-nowrap text-xs font-medium text-primary">
                      {t("common.pullToRefresh.release", "Lepas untuk refresh")}
                    </span>
                  ) : (
                    <RefreshCw
                      className="h-5 w-5 shrink-0 opacity-80"
                      style={{
                        transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                        transition: isPulling ? "none" : "transform 0.2s ease-out",
                      }}
                      aria-hidden
                    />
                  )}
                </div>

                <IncomeDashboardRefreshContext.Provider value={{ refetchRef, isRefreshing }}>
                  {/*
                    `content-padding-above-nav-default`: clearance tab `fixed` + napas — `index.css`; Android native tanpa inset ganda. Jangan tambah px-2 di child section.
                  */}
                  <div
                    className={cn(
                      "content-padding-above-nav-default mx-auto flex min-w-0 w-full max-w-md flex-col gap-1 px-2 pt-2",
                      stretchScrollContent && "min-h-0 flex-1",
                    )}
                  >
                    <ModuleShellContentGate pagePath={pagePath} className="flex min-h-0 min-w-0 flex-1 flex-col">
                      {children}
                    </ModuleShellContentGate>
                  </div>
                </IncomeDashboardRefreshContext.Provider>
                </div>
              </div>
            </div>

            <IncomeBottomTabs className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
