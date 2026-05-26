import { memo, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { MobileSubscriptionPageShell } from "@/mobile/6-subscription/components/MobileSubscriptionPageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { ManagementTabPageSkeleton } from "./ManagementTabPageSkeleton";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useNextBillingFromPayments } from "@/10-subscription/hooks/useNextBillingFromPayments";
import { useLastPaidSubscription } from "@/10-subscription/hooks/useLastPaidSubscription";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { MobileCurrentPlanCard } from "./section/management/MobileCurrentPlanCard";
import { MobileSubscriptionStats } from "./section/management/MobileSubscriptionStats";
import { MobilePaymentHistory } from "./section/management/MobilePaymentHistory";
import { useSubscriptionTabs } from "@/mobile/6-subscription/shared/SubscriptionTabs";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { RefreshCw, Loader2 } from "lucide-react";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const ManagementTabPage = memo(() => {
  useStatusBarStyle("light");
  useOptimizedPerformanceMonitor("ManagementTabPageMobile");
  const { t } = useAppTranslation();
  const { activeTab, handleTabChange, setActiveTabOnLocationChange } = useSubscriptionTabs("management");
  const { organizationId } = useCurrentOrg();
  const { subscriptionStatus, isLoading, statusError, refreshSubscriptionStatus } = useOptimizedSubscription();
  const { nextBillingDate, daysUntilExpiry, paymentsLoading } = useNextBillingFromPayments(organizationId ?? undefined);
  const { lastPaidAmount } = useLastPaidSubscription(organizationId ?? undefined);
  const nextBillingOverride =
    nextBillingDate != null ? { date: nextBillingDate, daysRemaining: daysUntilExpiry } : null;

  useEffect(() => {
    setActiveTabOnLocationChange();
  }, [setActiveTabOnLocationChange]);

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
      await refreshSubscriptionStatus();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshSubscriptionStatus]);

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

  let content: ReactNode;
  if (isLoading && !subscriptionStatus && !isRefreshing) {
    content = <ManagementTabPageSkeleton />;
  } else if (statusError) {
    content = (
      <Card className="border border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("subscription.management.errorTitle", "Gagal memuat data subscription")}
          </CardTitle>
          <CardDescription>
            {t("subscription.management.errorDescription", "Terjadi kesalahan saat memuat data. Periksa koneksi dan coba lagi.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => refreshSubscriptionStatus()}>
            {t("subscription.management.retryButton", "Coba lagi")}
          </Button>
        </CardContent>
      </Card>
    );
  } else if (!subscriptionStatus) {
    content = (
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>{t("subscription.management.noDataTitle", "Subscription belum tersedia")}</CardTitle>
          <CardDescription>
            {t("subscription.management.noDataDescription", "Kami belum dapat menemukan informasi subscription aktif untuk organisasi Anda.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => refreshSubscriptionStatus()}>
            {t("subscription.management.refreshStatus", "Perbarui Status")}
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <div className="space-y-1">
        <MobileCurrentPlanCard
          subscriptionStatus={subscriptionStatus}
          onRefresh={refreshSubscriptionStatus}
          isRefreshing={isLoading}
          nextBillingOverride={nextBillingOverride}
          nextBillingLoading={paymentsLoading}
        />
        <MobileSubscriptionStats
          subscriptionStatus={subscriptionStatus}
          nextBillingOverride={nextBillingOverride}
          nextBillingLoading={paymentsLoading}
          lastPaidAmount={lastPaidAmount}
        />
        <MobilePaymentHistory />
      </div>
    );
  }

  return (
    <MobileSubscriptionPageShell
      pagePath={MOBILE_PAGE_PATH.subscriptionManagement}
      headerVariant="management"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <div
        ref={listScrollRef}
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <div
            className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
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
          <div className="content-padding-above-nav-default mx-auto flex min-w-0 w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2">
            {content}
          </div>
        </div>
      </div>
    </MobileSubscriptionPageShell>
  );
});

ManagementTabPage.displayName = "ManagementTabPage";

export default ManagementTabPage;
