import { memo, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { OverviewTabPageSkeleton } from "./OverviewTabPageSkeleton";
import { useOptimizedPerformanceMonitor } from "@/features/10-management/hooks/useOptimizedPerformanceMonitor";
import { useOptimizedSubscription } from "@/features/10-management/hooks/useOptimizedSubscription";
import { useNextBillingFromPayments } from "@/features/10-management/hooks/useNextBillingFromPayments";
import { useSubscriptionAnalytics } from "@/features/10-overview/hooks/useSubscriptionAnalytics";
import { useCurrentOrg } from "@/features/1-login/hooks/useCurrentOrg";
import { CurrentSubscription, EmployeeGrowthChart, UsageMetricsCards } from "@/features/10-overview/section";
import { SubscriptionBottomTabs, useSubscriptionTabs } from "@/mobile/pages/subscription/shared/SubscriptionTabs";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { RefreshCw, Loader2 } from "lucide-react";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const OverviewTabPage = memo(() => {
  useOptimizedPerformanceMonitor("OverviewTabPageMobile");
  const { t } = useAppTranslation();
  const { activeTab, handleTabChange, setActiveTabOnLocationChange } = useSubscriptionTabs("overview");

  const { organizationId } = useCurrentOrg();

  const { subscriptionStatus, isLoading, statusError, refreshSubscriptionStatus } = useOptimizedSubscription();
  const { nextBillingDate, daysUntilExpiry, paymentsLoading } = useNextBillingFromPayments(organizationId ?? undefined);
  const nextBillingOverride =
    nextBillingDate != null ? { date: nextBillingDate, daysRemaining: daysUntilExpiry } : null;
  const { analytics, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useSubscriptionAnalytics();

  const isInitialLoading = isLoading && !subscriptionStatus;
  const subscriptionStatusRef = useRef(subscriptionStatus);
  const statusErrorRef = useRef(statusError);
  subscriptionStatusRef.current = subscriptionStatus;
  statusErrorRef.current = statusError;

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
      await Promise.all([refreshSubscriptionStatus(), refetchAnalytics()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshSubscriptionStatus, refetchAnalytics]);

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
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
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
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  useEffect(() => {
    setActiveTabOnLocationChange();
  }, [setActiveTabOnLocationChange]);

  useEffect(() => {
    if (organizationId && isLoading && !subscriptionStatus && !statusError) {
      const timer = window.setTimeout(() => {
        if (!subscriptionStatusRef.current && !statusErrorRef.current) {
          refreshSubscriptionStatus();
        }
      }, 10000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [organizationId, isLoading, subscriptionStatus, statusError, refreshSubscriptionStatus]);

  useStatusBarStyle('light');

  let content: ReactNode;
  if (isInitialLoading && !isRefreshing) {
    content = <OverviewTabPageSkeleton />;
  } else {
    content = (
      <div className="space-y-1">
        {statusError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">{t("subscription.overview.errorTitle", "Gagal memuat data")}</CardTitle>
              <CardDescription className="text-destructive">
                {t("subscription.overview.errorDescription", "Silakan coba muat ulang data subscription Anda.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => refreshSubscriptionStatus()}>
                {t("subscription.overview.refresh", "Muat ulang data")}
              </Button>
            </CardContent>
          </Card>
        )}

        {!statusError && subscriptionStatus && (
          <CurrentSubscription
            subscriptionStatus={subscriptionStatus}
            nextBillingOverride={nextBillingOverride}
            nextBillingLoading={paymentsLoading}
          />
        )}
        {analyticsError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">{t("subscription.overview.analyticsErrorTitle", "Data analitik tidak tersedia")}</CardTitle>
              <CardDescription className="text-destructive">
                {t("subscription.overview.analyticsErrorDescription", "Silakan coba muat ulang data analitik.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => refetchAnalytics()}>
                {t("subscription.overview.refresh", "Muat ulang data")}
              </Button>
            </CardContent>
          </Card>
        )}
        <EmployeeGrowthChart data={analytics?.employee_growth || []} isLoading={analyticsLoading} />
        <UsageMetricsCards metrics={analytics?.usage_metrics || null} isLoading={analyticsLoading} />
      </div>
    );
  }

  const { mainFixedStyle } = useVisualViewport();

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />

          {/* Same structure as Home/Daily Task/Profile/LiveChat: fixed viewport container, header (safe-area-top), scrollable content, footer (safe-area-bottom-lower) */}
            <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
            <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div>
                  <h1 className="text-base font-semibold text-foreground">{t("subscription.overview.pageTitle", "Subscription Overview")}</h1>
                  <p className="text-xs text-muted-foreground">{t("subscription.overview.pageSubtitle", "Plan status and usage")}</p>
                </div>
              </div>
              <div />
            </header>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div
                ref={listScrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div
                  className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
                  style={{
                    height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                    minHeight: 0,
                    transition: isPulling ? "none" : "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
                  ) : pullDistance >= PULL_THRESHOLD ? (
                    <span className="text-xs font-medium text-primary whitespace-nowrap">
                      {t("common.pullToRefresh.release", "Lepas untuk refresh")}
                    </span>
                  ) : (
                    <RefreshCw
                      className="h-5 w-5 opacity-80 shrink-0"
                      style={{
                        transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                        transition: isPulling ? "none" : "transform 0.2s ease-out",
                      }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="mx-auto w-full max-w-md px-2 pt-2 space-y-1 content-padding-above-nav-default">
                  {content}
                </div>
              </div>
            </div>

            <SubscriptionBottomTabs activeTab={activeTab} onTabChange={handleTabChange} className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
});

OverviewTabPage.displayName = "OverviewTabPage";

export default OverviewTabPage;
