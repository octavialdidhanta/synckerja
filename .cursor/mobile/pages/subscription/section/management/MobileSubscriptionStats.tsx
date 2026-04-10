import { memo, useMemo } from "react";
import { Card, CardContent } from "@/mobile/components/ui/card";
import type { SubscriptionStatus } from "@/features/10-management/hooks/useOptimizedSubscription";
import { Calendar, Users, Clock3, Shield } from "lucide-react";
import { formatIDR } from "@/features/1-login/utils/subscriptionUtils";
import { formatSubscriptionDate } from "@/features/10-management/utils/dateUtils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface MobileSubscriptionStatsProps {
  subscriptionStatus: SubscriptionStatus;
  /** Override next billing date/days to match Payment History (sync with desktop) */
  nextBillingOverride?: { date: Date | null; daysRemaining: number } | null;
  /** When true and no override, show loading for period/days */
  nextBillingLoading?: boolean;
  /** When provided, show this as "Estimated bill" (last paid amount) instead of computed plan price */
  lastPaidAmount?: number | null;
}

export const MobileSubscriptionStats = memo(({ subscriptionStatus, nextBillingOverride, nextBillingLoading, lastPaidAmount }: MobileSubscriptionStatsProps) => {
  const { t } = useAppTranslation();
  const periodEndValue =
    nextBillingLoading && !nextBillingOverride
      ? "..."
      : formatSubscriptionDate(
          nextBillingOverride?.date?.toISOString() ?? subscriptionStatus.subscription_end_date ?? subscriptionStatus.end_date,
          { month: "short" },
        );
  const daysLeftValue =
    nextBillingLoading && !nextBillingOverride ? "..." : `${nextBillingOverride?.daysRemaining ?? subscriptionStatus.days_until_expiry ?? 0} ${t("subscription.management.daysUnit")}`;

  const stats = useMemo(
    () => [
      {
        icon: Shield,
        title: t("subscription.management.statusPlan"),
        value: subscriptionStatus.is_trial
          ? t("subscription.management.trialActive")
          : subscriptionStatus.is_active
            ? t("subscription.management.statusActive")
            : t("subscription.management.statusInactive"),
        accent: "bg-emerald-100 text-emerald-700",
      },
      {
        icon: Calendar,
        title: t("subscription.management.periodEnd"),
        value: periodEndValue,
        accent: "bg-blue-100 text-blue-700",
      },
      {
        icon: Users,
        title: t("subscription.management.membersUsed"),
        value: `${subscriptionStatus.current_employees}/${subscriptionStatus.member_count}`,
        accent: "bg-amber-100 text-amber-700",
      },
      {
        icon: Clock3,
        title: t("subscription.management.daysLeft"),
        value: daysLeftValue,
        accent: "bg-purple-100 text-purple-700",
      },
    ],
    [subscriptionStatus, t, periodEndValue, daysLeftValue],
  );

  const billingSummary = useMemo(() => {
    const billingCycleLabel = subscriptionStatus.billing_cycle === "yearly" ? t("subscription.management.yearly") : t("subscription.management.monthly");
    if (lastPaidAmount != null && lastPaidAmount > 0) {
      return { billingCycle: billingCycleLabel, amount: formatIDR(lastPaidAmount) };
    }
    const basePrice = subscriptionStatus.base_price_per_member || 0;
    const discountPct = subscriptionStatus.annual_discount_percentage ?? 0;
    const amount =
      subscriptionStatus.billing_cycle === "yearly"
        ? basePrice * subscriptionStatus.member_count * 12 * (1 - discountPct / 100)
        : basePrice * subscriptionStatus.member_count;
    return { billingCycle: billingCycleLabel, amount: formatIDR(amount) };
  }, [subscriptionStatus, t, lastPaidAmount]);

  return (
    <div className="space-y-1">
      <Card className="border border-border">
        <CardContent className="grid grid-cols-2 gap-3 p-3">
          {stats.map((stat, index) => (
            <div key={stat.title} className="space-y-1 rounded-xl border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${stat.accent}`}>
                  <stat.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">{stat.title}</p>
              <p className="text-sm font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm text-muted-foreground">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide">{t("subscription.management.billingSummary")}</p>
            <p className="text-sm font-semibold text-foreground">{billingSummary.billingCycle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs">{t("subscription.management.estimateBill")}</p>
            <p className="text-sm font-semibold text-foreground">{billingSummary.amount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

MobileSubscriptionStats.displayName = "MobileSubscriptionStats";

