import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  ExpenseBottomTabs,
  type ExpenseTabKey,
  useExpenseTabs,
} from "@/mobile/2-expense/shared/ExpenseTabs";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { useNativeViewportNoPinchZoom } from "@/shared/hooks/useNativeViewportNoPinchZoom";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

export type MobileExpensesShellProps = {
  /** Title/subtitle are shown in the header (per mobile-tools-layout-android rule). */
  title: string;
  subtitle: string;
  /** Which tab is active for bottom nav highlighting and route sync. */
  initialTab?: ExpenseTabKey;
  children: ReactNode;
};

/**
 * Shared fixed-viewport mobile shell for all `/expenses/*` routes.
 * Mirrors the reference mobile expenses shell: header + pull-to-refresh scroll + bottom tabs.
 */
export function MobileExpensesShell({
  title,
  subtitle,
  initialTab = "dashboard",
  children,
}: MobileExpensesShellProps) {
  useNativeViewportNoPinchZoom();
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const { activeTab, handleTabChange } = useExpenseTabs(initialTab);

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
      // Keep this generic; specific tab sections can toast as needed.
      // This is just the shell fallback message.
      // eslint-disable-next-line no-console
      console.warn("[expenses][pull-to-refresh] refetch failed");
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
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  return (
    <DesktopWarning>
      <SidebarProvider>
        {/* Block wrapper: avoid shrink-to-fit in flex row layouts */}
        <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
          <AppSidebar />
          <main
            className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 max-w-none flex-col bg-background"
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
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                aria-label={t("expenses.scrollArea", "Expense content")}
              >
                <div
                  className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
                  style={{
                    height:
                      pullDistance > 0
                        ? Math.min(pullDistance, MAX_PULL)
                        : isRefreshing
                          ? INDICATOR_HEIGHT
                          : 0,
                    transition: isPulling ? "none" : "height 0.35s ease, min-height 0.35s ease",
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

                <ExpenseDashboardRefreshContext.Provider value={{ refetchRef, isRefreshing }}>
                  {/*
                    mobile-tools-layout-android.mdc:
                    - satu wrapper: max-w-md mx-auto w-full px-2 pt-2
                    - jarak antar section: space-y-1
                    - padding bawah kartu terakhir → nav: content-padding-above-nav-default (4rem, banyak kartu)
                    - jangan tambah px-2 di child section
                  */}
                  <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-default min-w-0">
                    {children}
                  </div>
                </ExpenseDashboardRefreshContext.Provider>
              </div>
            </div>

            <ExpenseBottomTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              className="safe-area-bottom-lower"
            />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}

