import { useState, useRef, useEffect, useCallback } from "react";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Loader2 } from "lucide-react";
import { useIncomeDashboardStats } from "./hooks/useIncomeDashboardStats";
import { IncomeDashboardCarousel } from "./section/IncomeDashboardCarousel";
import { IncomeDistributionSection } from "./section/IncomeDistributionSection";
import { NetIncomePerBankAccountSection } from "./section/NetIncomePerBankAccountSection";
import { IncomeBottomTabs } from "./shared/IncomeBottomTabs";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

export default function IncomeDashboardPage() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["income-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["income-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["bank-account-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, queryClient]);

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
    if (d >= PULL_THRESHOLD) void handlePullRefresh();
  }, [handlePullRefresh]);

  const {
    isLoading,
    totalCurrentBalance,
    totalIncome,
    totalIncomeMonthToDate,
    growth,
    highest,
    highestRecordedAt,
    highestTransactionName,
    latest,
    latestRecordedAt,
    latestTransactionName,
  } = useIncomeDashboardStats(selectedPeriod);

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
            <header className="flex-shrink-0 sticky top-0 z-30 flex items-center gap-2 p-3 bg-card border-b border-border safe-area-top">
              <SidebarTrigger className="md:hidden" />
              <div>
                <h1 className="text-base font-semibold text-foreground">
                  {t("incomes.pageTitle", "Incomes")}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t("incomes.dashboardSubtitle", "Dashboard")}
                </p>
              </div>
            </header>
            <div
              ref={listScrollRef}
              className="flex-1 min-h-0 overflow-auto seamless-scroll pt-2 pb-0"
              style={{ paddingBottom: "calc(3.8rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))" }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
                style={{
                  height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                  minHeight: 0,
                  transition: isPulling ? "none" : "height 0.35s ease-in-out",
                }}
              >
                {isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                ) : pullDistance >= PULL_THRESHOLD ? (
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    {t("common.pullToRefresh.release", "Lepas untuk refresh")}
                  </span>
                ) : (
                  <RefreshCw
                    className="h-5 w-5 opacity-80"
                    style={{
                      transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                      transition: isPulling ? "none" : "transform 0.22s ease-in-out",
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <IncomeDashboardCarousel
                isLoading={isLoading}
                totalCurrentBalance={totalCurrentBalance}
                totalIncome={totalIncome}
                totalIncomeMonthToDate={totalIncomeMonthToDate}
                growth={growth}
                highest={highest}
                highestRecordedAt={highestRecordedAt}
                highestTransactionName={highestTransactionName}
                latest={latest}
                latestRecordedAt={latestRecordedAt}
                latestTransactionName={latestTransactionName}
              />
              <IncomeDistributionSection selectedPeriod={selectedPeriod} onSelectedPeriodChange={setSelectedPeriod} />
              <NetIncomePerBankAccountSection />
            </div>
            <IncomeBottomTabs />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
