import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/shared/components/ui/card";
import { CreditCard, Users, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

interface MetricCardsProps {
  subscriptionStatus: SubscriptionStatus | null;
  daysRemainingOverride?: number | null;
  nextBillingLoading?: boolean;
}

export const MetricCards = memo(
  function MetricCards({ subscriptionStatus, daysRemainingOverride, nextBillingLoading }: MetricCardsProps) {
    const { t } = useTranslation();

    const quickStats = useMemo(() => {
      if (!subscriptionStatus) return [];

      const planName = subscriptionStatus.plan_name || t("subscription.overview.metricNoPlan");
      const isActive = subscriptionStatus.is_active || false;
      const currentEmployees =
        subscriptionStatus.current_employees || subscriptionStatus.employee_count || 0;
      const memberLimit = subscriptionStatus.member_count || subscriptionStatus.member_limit || 0;

      const daysLeftLoading = nextBillingLoading && daysRemainingOverride == null;
      const daysLeft = daysLeftLoading
        ? 0
        : Math.max(
            0,
            daysRemainingOverride ??
              subscriptionStatus.days_until_expiry ??
              subscriptionStatus.days_remaining ??
              0,
          );

      const isTrial = subscriptionStatus.is_trial || false;
      const statusLabel = isTrial
        ? t("subscription.overview.metricStatusTrial")
        : subscriptionStatus.status || t("subscription.overview.metricStatusUnknown");

      return [
        {
          title: t("subscription.overview.metricCurrentPlan"),
          value: planName,
          icon: CreditCard,
          color: isActive ? "text-brand-blue" : "text-brand-red",
        },
        {
          title: t("subscription.overview.metricActiveMembers"),
          value: `${currentEmployees} / ${memberLimit}`,
          icon: Users,
          color:
            subscriptionStatus.over_limit || subscriptionStatus.is_over_limit
              ? "text-brand-red"
              : "text-brand-blue",
        },
        {
          title: isTrial
            ? t("subscription.overview.metricTrialDaysLeft")
            : t("subscription.overview.metricDaysRemaining"),
          value: daysLeftLoading ? t("subscription.overview.loadingEllipsis") : daysLeft,
          icon: Calendar,
          color: daysLeftLoading
            ? "text-muted-foreground"
            : daysLeft <= 3
              ? "text-brand-red"
              : daysLeft <= 7
                ? "text-brand-red"
                : "text-brand-blue",
        },
        {
          title: t("subscription.overview.metricSubscriptionStatus"),
          value: statusLabel,
          icon: isActive ? CheckCircle : AlertCircle,
          color: isActive ? "text-brand-blue" : "text-brand-red",
        },
      ];
    }, [subscriptionStatus, daysRemainingOverride, nextBillingLoading, t]);

    const gridClass = "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4";

    if (!subscriptionStatus || quickStats.length === 0) {
      return (
        <div className={gridClass}>
          <Card className="min-w-0 border-border shadow-sm">
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {t("subscription.overview.metricCurrentPlan")}
                  </p>
                  <p className="truncate text-xl font-bold text-muted-foreground sm:text-2xl">
                    {t("subscription.overview.metricLoading")}
                  </p>
                </div>
                <CreditCard className="h-7 w-7 shrink-0 text-muted-foreground sm:h-8 sm:w-8" />
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border shadow-sm">
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {t("subscription.overview.metricActiveMembers")}
                  </p>
                  <p className="text-xl font-bold text-muted-foreground sm:text-2xl">— / —</p>
                </div>
                <Users className="h-7 w-7 shrink-0 text-muted-foreground sm:h-8 sm:w-8" />
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border shadow-sm">
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {t("subscription.overview.metricDaysRemaining")}
                  </p>
                  <p className="text-xl font-bold text-muted-foreground sm:text-2xl">—</p>
                </div>
                <Calendar className="h-7 w-7 shrink-0 text-muted-foreground sm:h-8 sm:w-8" />
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border shadow-sm">
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {t("subscription.overview.metricStatusShort")}
                  </p>
                  <p className="text-xl font-bold text-muted-foreground sm:text-2xl">
                    {t("subscription.overview.metricLoading")}
                  </p>
                </div>
                <AlertCircle className="h-7 w-7 shrink-0 text-muted-foreground sm:h-8 sm:w-8" />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className={gridClass}>
        {quickStats.map((stat, index) => (
          <Card
            key={index}
            className="min-w-0 border-border shadow-sm transition-shadow hover:shadow-md"
          >
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className={`truncate text-xl font-bold sm:text-2xl ${stat.color}`} title={String(stat.value)}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={`h-7 w-7 shrink-0 sm:h-8 sm:w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (!prevProps.subscriptionStatus && !nextProps.subscriptionStatus) return true;
    if (!prevProps.subscriptionStatus || !nextProps.subscriptionStatus) return false;

    const prevDays =
      prevProps.daysRemainingOverride ?? prevProps.subscriptionStatus.days_until_expiry;
    const nextDays =
      nextProps.daysRemainingOverride ?? nextProps.subscriptionStatus.days_until_expiry;

    return (
      prevProps.subscriptionStatus.plan_name === nextProps.subscriptionStatus.plan_name &&
      prevProps.subscriptionStatus.current_employees === nextProps.subscriptionStatus.current_employees &&
      prevProps.subscriptionStatus.member_count === nextProps.subscriptionStatus.member_count &&
      prevDays === nextDays &&
      prevProps.nextBillingLoading === nextProps.nextBillingLoading &&
      prevProps.subscriptionStatus.is_active === nextProps.subscriptionStatus.is_active
    );
  },
);
