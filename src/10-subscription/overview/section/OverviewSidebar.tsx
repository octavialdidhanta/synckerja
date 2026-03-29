import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Users, Calendar, TrendingUp } from "lucide-react";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

interface OverviewSidebarProps {
  subscriptionStatus: SubscriptionStatus | null;
}

export const OverviewSidebar = memo(function OverviewSidebar({ subscriptionStatus }: OverviewSidebarProps) {
  const { t } = useTranslation();

  const stats = useMemo(
    () => [
      {
        icon: Users,
        label: t("subscription.overview.sidebarActiveEmployees"),
        value: subscriptionStatus?.employee_count ?? subscriptionStatus?.current_employees ?? 0,
        color: "text-brand-blue",
        bgColor: "bg-brand-blue/10 dark:bg-brand-blue/20",
      },
      {
        icon: TrendingUp,
        label: t("subscription.overview.sidebarMemberLimit"),
        value: subscriptionStatus?.member_limit ?? subscriptionStatus?.member_count ?? 0,
        color: "text-brand-blue",
        bgColor: "bg-brand-blue/10 dark:bg-brand-blue/20",
      },
      {
        icon: Calendar,
        label: t("subscription.overview.sidebarPlanName"),
        value: subscriptionStatus?.plan_name || t("subscription.overview.metricNoPlan"),
        color: "text-brand-blue",
        bgColor: "bg-brand-blue/10 dark:bg-brand-blue/20",
      },
      {
        icon: Clock,
        label: t("subscription.overview.sidebarStatus"),
        value: subscriptionStatus?.status || t("subscription.overview.metricStatusUnknown"),
        color: "text-brand-red",
        bgColor: "bg-brand-red/10 dark:bg-brand-red/20",
      },
    ],
    [subscriptionStatus, t],
  );

  return (
    <div className="space-y-3">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="rounded-lg border border-border p-3 transition-colors hover:border-muted-foreground/30"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs text-muted-foreground">{stat.label}</p>
              <p className={`truncate text-sm font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
