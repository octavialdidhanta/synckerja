import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useNextBillingFromPayments } from "@/10-subscription/hooks/useNextBillingFromPayments";
import { useSubscriptionAnalytics } from "@/10-subscription/hooks/useSubscriptionAnalytics";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { cn } from "@/shared/lib/utils";
import {
  CurrentSubscription,
  EmployeeGrowthChart,
  FeatureUsageChart,
  MetricCards,
  OverviewFooter,
  OverviewSidebar,
  OverviewSidebarFooter,
  UsageMetricsCards,
} from "@/10-subscription/overview/section";

function OverviewPageSkeleton() {
  return (
    <div className="grid min-h-[calc(100dvh-210px)] w-full min-w-0 max-w-full flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[760px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[860px]">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-9">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-4 p-4">
            <div className="h-40 animate-pulse rounded bg-muted/60" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`overview-metric-skeleton-${i}`} className="h-24 animate-pulse rounded bg-muted/60" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded bg-muted/60" />
              <div className="h-64 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`overview-usage-skeleton-${i}`} className="h-20 animate-pulse rounded bg-muted/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`overview-sidebar-skeleton-${i}`} className="h-8 animate-pulse rounded bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const OverviewTabContent = memo(
  function OverviewTabContent({
    subscriptionStatus,
    analytics,
    refreshSubscriptionStatus,
    nextBillingOverride,
    nextBillingLoading,
    onFooterRefresh,
    isFooterRefreshing,
    omnichannelRosterActiveCount,
    omnichannelRosterPending,
  }: {
    subscriptionStatus: ReturnType<typeof useOptimizedSubscription>["subscriptionStatus"];
    analytics: ReturnType<typeof useSubscriptionAnalytics>["analytics"];
    refreshSubscriptionStatus: () => void;
    nextBillingOverride: { date: Date; daysRemaining: number } | null;
    nextBillingLoading: boolean;
    onFooterRefresh: () => Promise<void>;
    isFooterRefreshing: boolean;
    omnichannelRosterActiveCount: number;
    omnichannelRosterPending: boolean;
  }) {
    const { t } = useTranslation();
    const [lastUpdated] = useState(() => new Date());

    return (
      <div className="grid min-h-[calc(100dvh-210px)] w-full min-w-0 max-w-full flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[760px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[860px]">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-9">
          <div className="flex max-md:min-h-[360px] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground">{t("subscription.overview.pageTitle")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.pageSubtitle")}</p>
                </div>
              </div>
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-0 space-y-5 p-4">
              {subscriptionStatus && (
                <CurrentSubscription
                  subscriptionStatus={subscriptionStatus}
                  nextBillingOverride={nextBillingOverride}
                  nextBillingLoading={nextBillingLoading}
                />
              )}

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="shrink-0 text-lg font-semibold text-foreground">
                      {t("subscription.overview.subscriptionMetricsTitle")}
                    </h3>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {subscriptionStatus && (
                        <span
                          className="truncate text-sm text-muted-foreground"
                          title={subscriptionStatus.plan_name}
                        >
                          {t("subscription.overview.planLabel", { plan: subscriptionStatus.plan_name })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => refreshSubscriptionStatus()}
                        className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                        title={t("subscription.overview.refreshDataTitle")}
                      >
                        {t("subscription.overview.refreshData")}
                      </button>
                    </div>
                  </div>
                  <MetricCards
                    subscriptionStatus={subscriptionStatus}
                    daysRemainingOverride={nextBillingOverride?.daysRemaining}
                    nextBillingLoading={nextBillingLoading}
                    omnichannelRosterActiveCount={omnichannelRosterActiveCount}
                    omnichannelRosterPending={omnichannelRosterPending}
                  />
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                  <EmployeeGrowthChart data={analytics?.employee_growth ?? []} />
                  <FeatureUsageChart data={analytics?.feature_usage ?? []} />
                </div>
              </div>
              <div className="min-w-0 px-4 pb-4 pt-1">
                <UsageMetricsCards metrics={analytics?.usage_metrics ?? null} />
              </div>
            </div>

            <OverviewFooter
              totalMetrics={5}
              lastUpdated={lastUpdated}
              onRefresh={onFooterRefresh}
              isRefreshing={isFooterRefreshing}
            />
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-3">
          <div className="flex max-md:min-h-[280px] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold text-foreground">{t("subscription.overview.quickSummaryTitle")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.quickSummarySubtitle")}</p>
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <OverviewSidebar subscriptionStatus={subscriptionStatus} />
            </div>

            <OverviewSidebarFooter
              activeEmployees={subscriptionStatus?.employee_count ?? subscriptionStatus?.current_employees ?? 0}
              totalFeatures={analytics?.feature_usage?.length ?? 0}
            />
          </div>
        </div>
      </div>
    );
  },
);

export default function OverviewPage() {
  useOptimizedPerformanceMonitor("OverviewPage");
  const { organizationId } = useActiveOrganization();
  const { subscriptionStatus, statusLoading, statusError, refreshSubscriptionStatus } = useOptimizedSubscription();
  const { nextBillingDate, daysUntilExpiry, paymentsLoading } = useNextBillingFromPayments(organizationId);
  const nextBillingOverride =
    nextBillingDate != null ? { date: nextBillingDate, daysRemaining: daysUntilExpiry } : null;

  const { analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useSubscriptionAnalytics();
  const { data: omnichannelRoster = [], isPending: omnichannelRosterPending } = useOrganizationOmnichannelStaff();

  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);
  const [initialOverviewReady, setInitialOverviewReady] = useState(false);
  const [skeletonVisible, setSkeletonVisible] = useState(true);

  const handleOverviewFooterRefresh = useCallback(async () => {
    setIsFooterRefreshing(true);
    try {
      refreshSubscriptionStatus();
      await refetchAnalytics();
    } finally {
      setIsFooterRefreshing(false);
    }
  }, [refreshSubscriptionStatus, refetchAnalytics]);

  const initialBootstrapping =
    !organizationId ||
    statusLoading ||
    analyticsLoading ||
    paymentsLoading ||
    (!subscriptionStatus && !statusError);

  useEffect(() => {
    if (initialOverviewReady) return;

    if (initialBootstrapping) {
      setSkeletonVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setInitialOverviewReady(true);
      setSkeletonVisible(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [initialBootstrapping, initialOverviewReady]);

  const showShellSkeleton = !initialOverviewReady && skeletonVisible;

  return (
    <SubscriptionSectionLayout>
      <div className="relative box-border flex min-h-0 min-h-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden px-4 pb-2 pt-1">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            showShellSkeleton && "pointer-events-none invisible",
          )}
        >
          <OverviewTabContent
            subscriptionStatus={subscriptionStatus}
            analytics={analytics}
            refreshSubscriptionStatus={refreshSubscriptionStatus}
            nextBillingOverride={nextBillingOverride}
            nextBillingLoading={initialOverviewReady ? paymentsLoading : false}
            onFooterRefresh={handleOverviewFooterRefresh}
            isFooterRefreshing={isFooterRefreshing}
            omnichannelRosterActiveCount={omnichannelRoster.length}
            omnichannelRosterPending={omnichannelRosterPending}
          />
          <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
        </div>
        {showShellSkeleton ? (
          <div
            className="absolute inset-0 z-10 scrollbar-hide seamless-scroll nested-scroll-touch-chain overflow-y-auto overflow-x-hidden bg-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-busy="true"
          >
            <OverviewPageSkeleton />
          </div>
        ) : null}
      </div>
    </SubscriptionSectionLayout>
  );
}
