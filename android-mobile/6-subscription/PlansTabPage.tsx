import { memo, useState, useRef, useEffect, useCallback } from "react";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { SubscriptionBottomTabs, useSubscriptionTabs } from "@/mobile/6-subscription/shared/SubscriptionTabs";
import HRISSubscriptionPlansTab from "@/mobile/6-subscription/section/HRISSubscriptionPlansTab";
import { MobileSubscriptionPlansPageSkeletonOverlay } from "@/mobile/6-subscription/pages/MobileSubscriptionPlansPageSkeletonOverlay";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useSubscriptionPlans } from "@/10-subscription/hooks/useSubscriptionPlans";
import { useEmployeeCount } from "@/10-subscription/hooks/useEmployeeCount";
import { useLastPaidSubscription } from "@/10-subscription/hooks/useLastPaidSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
const SKELETON_MIN_MS = 280;

const PlansTabPage = memo(() => {
  useStatusBarStyle("light");
  const { mainFixedStyle } = useVisualViewport();
  useOptimizedPerformanceMonitor("PlansTabPageMobile");
  const { t } = useAppTranslation();
  const { activeTab, handleTabChange, setActiveTabOnLocationChange } = useSubscriptionTabs("plans");

  const { organizationId, loading: orgLoading } = useActiveOrganization();
  const { subscriptionStatus, statusLoading, statusError, isLoading: subscriptionHookLoading } =
    useOptimizedSubscription();
  const { isLoading: plansLoading } = useSubscriptionPlans();
  const { isLoading: employeeCountLoading } = useEmployeeCount();
  const { isLoading: lastPaidLoading } = useLastPaidSubscription(organizationId);

  const blockingLoad =
    orgLoading ||
    !organizationId ||
    statusLoading ||
    subscriptionHookLoading ||
    plansLoading ||
    employeeCountLoading ||
    lastPaidLoading ||
    (!subscriptionStatus && !statusError);

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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const showPageSkeleton = (blockingLoad || !minSettleDone) && !isRefreshing;

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
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetchRef.current?.();
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

  const showPullChrome = !(blockingLoad && !isRefreshing);

  return (
    <DesktopWarning>
      <SidebarProvider>
        {/* Layout per android-mobile/rules/mobile-tools-layout-android.mdc; selaras DailyTaskPage (fixed main + useVisualViewport). */}
        <div className="flex min-h-screen min-w-0 w-full bg-background">
          <AppSidebar />

          <main
            className={cn(
              "fixed inset-x-0 z-0 flex min-h-0 w-full max-w-none min-w-0 flex-col bg-background",
              showPageSkeleton && "pointer-events-none invisible select-none",
            )}
            style={mainFixedStyle}
            aria-hidden={showPageSkeleton}
          >
            <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <SidebarTrigger className="md:hidden shrink-0" />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold leading-tight text-foreground">
                    {t("subscription.plans.title", "Subscription Plans")}
                  </h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("subscription.plans.description", "Choose the perfect plan for your organization")}
                  </p>
                </div>
              </div>
              <div />
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={listScrollRef}
                className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                      transition: isPulling ? "none" : "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
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
                <div className="flex min-h-full min-w-0 flex-1 flex-col">
                  <div className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2 content-padding-above-nav-default">
                    <HRISSubscriptionPlansTab refetchRef={refetchRef} />
                  </div>
                </div>
              </div>
            </div>

            <SubscriptionBottomTabs activeTab={activeTab} onTabChange={handleTabChange} className="safe-area-bottom-lower" />
          </main>

          {showPageSkeleton ? <MobileSubscriptionPlansPageSkeletonOverlay /> : null}
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
});

PlansTabPage.displayName = "PlansTabPage";

export default PlansTabPage;
