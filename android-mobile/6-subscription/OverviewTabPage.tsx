import { memo, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { MobileSubscriptionOverviewPageSkeletonOverlay } from "@/mobile/6-subscription/pages/MobileSubscriptionOverviewPageSkeletonOverlay";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useNextBillingFromPayments } from "@/10-subscription/hooks/useNextBillingFromPayments";
import { useSubscriptionAnalytics } from "@/10-subscription/hooks/useSubscriptionAnalytics";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { CurrentSubscription, EmployeeGrowthChart, UsageMetricsCards } from "@/10-subscription/overview/section";
import { SubscriptionBottomTabs, useSubscriptionTabs } from "@/mobile/6-subscription/shared/SubscriptionTabs";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
const SKELETON_MIN_MS = 280;

const OverviewTabPage = memo(() => {
  useOptimizedPerformanceMonitor("OverviewTabPageMobile");
  const { t } = useAppTranslation();
  const { activeTab, handleTabChange, setActiveTabOnLocationChange } = useSubscriptionTabs("overview");

  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const { subscriptionStatus, isLoading, statusError, refreshSubscriptionStatus } = useOptimizedSubscription();
  const { nextBillingDate, daysUntilExpiry, paymentsLoading } = useNextBillingFromPayments(organizationId ?? undefined);
  const nextBillingOverride =
    nextBillingDate != null ? { date: nextBillingDate, daysRemaining: daysUntilExpiry } : null;
  const { analytics, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useSubscriptionAnalytics();

  const subscriptionStatusRef = useRef(subscriptionStatus);
  const statusErrorRef = useRef(statusError);
  subscriptionStatusRef.current = subscriptionStatus;
  statusErrorRef.current = statusError;

  const blockingLoad = orgLoading || isLoading || analyticsLoading;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevBlockingRef = useRef(false);

  useEffect(() => {
    const pending = blockingLoad;
    const wasPending = prevBlockingRef.current;
    prevBlockingRef.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setMinSettleDone(true);
              skeletonShownAtRef.current = null;
            });
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [blockingLoad]);

  const showPageSkeleton = (blockingLoad || !minSettleDone) && !isRefreshing;

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

  useStatusBarStyle("light");
  const { mainFixedStyle } = useVisualViewport();

  const showPullChrome = !(blockingLoad && !isRefreshing);

  const content: ReactNode = (
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

  return (
    <DesktopWarning>
      <SidebarProvider>
        {/* Layout per android-mobile/rules/mobile-tools-layout-android.mdc */}
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />

          <main
            className={cn(
              "fixed inset-x-0 z-0 flex flex-col bg-background",
              showPageSkeleton && "pointer-events-none invisible select-none",
            )}
            style={mainFixedStyle}
            aria-hidden={showPageSkeleton}
          >
            <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div>
                  <h1 className="text-base font-semibold text-foreground">{t("subscription.overview.pageTitle", "Subscription Overview")}</h1>
                  <p className="text-xs text-muted-foreground">{t("subscription.overview.pageSubtitle", "Plan status and usage")}</p>
                </div>
              </div>
              <div />
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={listScrollRef}
                className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {showPullChrome && (
                  <div
                    className="flex shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
                    style={{
                      height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
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
                )}
                <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-default">
                  {content}
                </div>
              </div>
            </div>

            <SubscriptionBottomTabs activeTab={activeTab} onTabChange={handleTabChange} className="safe-area-bottom-lower" />
          </main>

          {showPageSkeleton ? <MobileSubscriptionOverviewPageSkeletonOverlay /> : null}
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
});

OverviewTabPage.displayName = "OverviewTabPage";

export default OverviewTabPage;
