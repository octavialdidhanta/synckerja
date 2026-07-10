import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useSubscriptionAnalytics } from "@/10-subscription/hooks/useSubscriptionAnalytics";
import { useOptimizedPerformanceMonitor } from "@/10-subscription/hooks/useOptimizedPerformanceMonitor";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";
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
    refreshSubscriptionStatus,
    onFooterRefresh,
    isFooterRefreshing,
    omnichannelRosterActiveCount,
    omnichannelRosterPending,
  }: {
    subscriptionStatus: ReturnType<typeof useOptimizedSubscription>["subscriptionStatus"];
    analytics: ReturnType<typeof useSubscriptionAnalytics>["analytics"];
    refreshSubscriptionStatus: () => void;
    onFooterRefresh: () => Promise<void>;
    isFooterRefreshing: boolean;
    omnichannelRosterActiveCount: number;
    omnichannelRosterPending: boolean;
  }) {
    const { t } = useTranslation();
    const [lastUpdated] = useState(() => new Date());

    return (
      <div className="grid w-full min-w-0 max-w-full grid-cols-12 gap-2">
        <div className="col-span-12 flex min-w-0 flex-col md:col-span-9">
          <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground">{t("subscription.overview.pageTitle")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.pageSubtitle")}</p>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="min-w-0 space-y-5 p-4">
              {subscriptionStatus && (
                <CurrentSubscription subscriptionStatus={subscriptionStatus} />
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

        <div className="col-span-12 flex min-w-0 flex-col md:col-span-3">
          <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold text-foreground">{t("subscription.overview.quickSummaryTitle")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.quickSummarySubtitle")}</p>
            </div>

            <div className="min-w-0 p-4">
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
  const { subscriptionStatus, statusLoading, statusError, refreshSubscriptionStatus } = useOptimizedSubscription();

  const { analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useSubscriptionAnalytics();
  const { data: omnichannelRoster = [], isPending: omnichannelRosterPending } = useOrganizationOmnichannelStaff();

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

  return (
    <SubscriptionSectionLayout>
      <div className="box-border flex min-w-0 w-full max-w-full flex-col px-4 pb-2 pt-1">
        <OverviewTabContent
          subscriptionStatus={subscriptionStatus}
          analytics={analytics}
          refreshSubscriptionStatus={refreshSubscriptionStatus}
          onFooterRefresh={handleOverviewFooterRefresh}
          isFooterRefreshing={isFooterRefreshing}
          omnichannelRosterActiveCount={omnichannelRoster.length}
          omnichannelRosterPending={omnichannelRosterPending}
        />
      </div>
    </SubscriptionSectionLayout>
  );
}
