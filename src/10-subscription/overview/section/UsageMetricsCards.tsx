import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/shared/components/ui/card";
import type { SubscriptionAnalytics } from "@/10-subscription/hooks/useSubscriptionAnalytics";

type UsageMetrics = SubscriptionAnalytics["usage_metrics"];

interface UsageMetricsCardsProps {
  metrics: UsageMetrics | null;
  isLoading?: boolean;
}

export const UsageMetricsCards = memo(function UsageMetricsCards({ metrics, isLoading }: UsageMetricsCardsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-1.5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={`usage-metrics-skeleton-${index}`}>
            <CardContent className="p-3">
              <div className="space-y-1.5 text-center">
                <div className="mx-auto h-8 w-14 animate-pulse rounded bg-muted" />
                <div className="mx-auto h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 md:grid-cols-3">
      <Card>
        <CardContent className="p-2.5">
          <div className="text-center">
            <div className="text-2xl font-semibold text-brand-blue">{Math.round(metrics.employee_utilization_percentage)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.employeeUtilization")}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-2.5">
          <div className="text-center">
            <div className="text-2xl font-semibold text-brand-blue">{Math.round(metrics.plan_efficiency_score)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.planEfficiency")}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-2.5">
          <div className="text-center">
            <div className="text-2xl font-semibold text-brand-red">{Math.round(metrics.growth_rate)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.growthRate")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
