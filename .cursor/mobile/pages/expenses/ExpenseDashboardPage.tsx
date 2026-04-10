import { memo, useEffect, useState, useRef, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { ExpenseBottomTabs, useExpenseTabs } from "@/mobile/pages/expenses/shared/ExpenseTabs";
import { DashboardTabContent } from "@/mobile/pages/expenses/section/DashboardTabContent";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";
import { DebtTabContent } from "@/mobile/pages/expenses/debt";
import { ApprovalsTabContent } from "@/mobile/pages/expenses/approvals";
import { PaymentTabContent } from "@/mobile/pages/expenses/payment";
import { BillsTabContent } from "@/mobile/pages/expenses/bills";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { toast } from "sonner";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const ExpenseDashboardPage = memo(() => {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { activeTab, handleTabChange, setActiveTabOnLocationChange } =
    useExpenseTabs("dashboard");

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

  useEffect(() => {
    setActiveTabOnLocationChange();
  }, [setActiveTabOnLocationChange]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const refetch = refetchRef.current;
    if (!refetch) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      toast.error(t("expenses.refreshFailed", "Gagal memuat ulang data"));
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, t]);

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
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      handlePullRefresh();
    }
  }, [handlePullRefresh]);

  const { height: viewportHeight, offsetTop: viewportOffsetTop } =
    useVisualViewport();

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />

          <main
            className="flex flex-col bg-background fixed inset-x-0 z-0"
            style={{
              top: viewportOffsetTop,
              height: viewportHeight > 0 ? viewportHeight : undefined,
              minHeight: viewportHeight > 0 ? undefined : "100dvh",
            }}
          >
            <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div>
                  <h1 className="text-base font-semibold text-foreground">
                    {t("expenses.pageTitle", "Expense")}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {t("expenses.pageSubtitle", "Dashboard pengeluaran")}
                  </p>
                </div>
              </div>
              <div />
            </header>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div
                ref={listScrollRef}
                className="flex-1 overflow-y-auto overflow-x-auto seamless-scroll min-h-0 flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div
                  className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm min-h-0"
                  style={{
                    height:
                      pullDistance > 0
                        ? Math.min(pullDistance, MAX_PULL)
                        : isRefreshing
                          ? INDICATOR_HEIGHT
                          : 0,
                    transition: isPulling
                      ? "none"
                      : "height 0.4s ease-in-out, min-height 0.4s ease-in-out",
                  }}
                >
                  {isRefreshing ? (
                    <Loader2
                      className="h-5 w-5 animate-spin text-primary shrink-0"
                      aria-hidden
                    />
                  ) : pullDistance >= PULL_THRESHOLD ? (
                    <span className="text-xs font-medium text-primary whitespace-nowrap">
                      {t("common.pullToRefresh.release", "Lepas untuk refresh")}
                    </span>
                  ) : (
                    <RefreshCw
                      className="h-5 w-5 opacity-80 shrink-0"
                      style={{
                        transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                        transition: isPulling ? "none" : "transform 0.25s ease-in-out",
                      }}
                      aria-hidden
                    />
                  )}
                </div>
                <ExpenseDashboardRefreshContext.Provider
                  value={{ refetchRef, isRefreshing }}
                >
                  {activeTab === "dashboard" && (
                    <div className="w-full pt-2 content-padding-above-nav-home">
                      <DashboardTabContent />
                    </div>
                  )}
                  {activeTab === "debt" && (
                    <div className="w-full pt-2 content-padding-above-nav-home">
                      <DebtTabContent />
                    </div>
                  )}
                  {activeTab === "approvals" && (
                    <div className="w-full pt-2 content-padding-above-nav-home">
                      <ApprovalsTabContent />
                    </div>
                  )}
                  {activeTab === "payment" && (
                    <div className="w-full pt-2 content-padding-above-nav-home">
                      <PaymentTabContent />
                    </div>
                  )}
                  {activeTab === "bills" && (
                    <div className="w-full pt-2 content-padding-above-nav-home">
                      <BillsTabContent />
                    </div>
                  )}
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
});

ExpenseDashboardPage.displayName = "ExpenseDashboardPage";

export default ExpenseDashboardPage;
