import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useNextBillingFromPayments } from "@/10-subscription/hooks/useNextBillingFromPayments";
import { useSubscriptionAnalytics } from "@/10-subscription/hooks/useSubscriptionAnalytics";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { PageSpinner } from "@/10-subscription/shared/PageSpinner";
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

const OverviewTabContent = memo(
  function OverviewTabContent({
    subscriptionStatus,
    analytics,
    analyticsLoading,
    refreshSubscriptionStatus,
    nextBillingOverride,
    nextBillingLoading,
    onFooterRefresh,
    isFooterRefreshing,
  }: {
    subscriptionStatus: ReturnType<typeof useOptimizedSubscription>["subscriptionStatus"];
    analytics: ReturnType<typeof useSubscriptionAnalytics>["analytics"];
    analyticsLoading: boolean;
    refreshSubscriptionStatus: () => void;
    nextBillingOverride: { date: Date; daysRemaining: number } | null;
    nextBillingLoading: boolean;
    onFooterRefresh: () => Promise<void>;
    isFooterRefreshing: boolean;
  }) {
    const { t } = useTranslation();
    const [lastUpdated] = useState(() => new Date());

    return (
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex min-h-0 flex-col md:col-span-9">
          <div className="flex max-md:min-h-[360px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground">{t("subscription.overview.pageTitle")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.pageSubtitle")}</p>
                </div>
              </div>
            </div>

            <div className="nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="space-y-4 p-4">
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
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <EmployeeGrowthChart
                    data={analytics?.employee_growth ?? []}
                    isLoading={analyticsLoading}
                  />
                  <FeatureUsageChart data={analytics?.feature_usage ?? []} isLoading={analyticsLoading} />
                </div>

                <UsageMetricsCards
                  metrics={analytics?.usage_metrics ?? null}
                  isLoading={analyticsLoading}
                />
              </div>
            </div>

            <OverviewFooter
              totalMetrics={4}
              lastUpdated={lastUpdated}
              onRefresh={onFooterRefresh}
              isRefreshing={isFooterRefreshing}
            />
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col md:col-span-3">
          <div className="flex max-md:min-h-[280px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold text-foreground">{t("subscription.overview.quickSummaryTitle")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.quickSummarySubtitle")}</p>
            </div>

            <div className="nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
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

  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);

  const handleOverviewFooterRefresh = useCallback(async () => {
    setIsFooterRefreshing(true);
    try {
      refreshSubscriptionStatus();
      await refetchAnalytics();
    } finally {
      setIsFooterRefreshing(false);
    }
  }, [refreshSubscriptionStatus, refetchAnalytics]);

  const showInitialSpinner = !organizationId || (statusLoading && !subscriptionStatus && !statusError);

  return (
    <SubscriptionSectionLayout>
      <div className="box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showInitialSpinner ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <PageSpinner />
            </div>
          ) : (
            <OverviewTabContent
              subscriptionStatus={subscriptionStatus}
              analytics={analytics}
              analyticsLoading={analyticsLoading}
              refreshSubscriptionStatus={refreshSubscriptionStatus}
              nextBillingOverride={nextBillingOverride}
              nextBillingLoading={paymentsLoading}
              onFooterRefresh={handleOverviewFooterRefresh}
              isFooterRefreshing={isFooterRefreshing}
            />
          )}
        </div>
      </div>
    </SubscriptionSectionLayout>
  );
}
