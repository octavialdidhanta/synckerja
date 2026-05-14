import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Calendar, Users, CreditCard, AlertTriangle, Puzzle } from "lucide-react";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

interface CurrentSubscriptionProps {
  subscriptionStatus: SubscriptionStatus;
  nextBillingOverride?: { date: Date | null; daysRemaining: number } | null;
  nextBillingLoading?: boolean;
}

export const CurrentSubscription = memo(function CurrentSubscription({
  subscriptionStatus,
  nextBillingOverride,
  nextBillingLoading,
}: CurrentSubscriptionProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    if (!dateString || typeof dateString !== "string") return "—";
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return "—";
    return date.toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const maxEmployees = subscriptionStatus.member_count || subscriptionStatus.member_limit || 1000;
  const employeeUsagePercentage =
    maxEmployees > 0 ? (subscriptionStatus.current_employees / maxEmployees) * 100 : 0;
  const isNearLimit = employeeUsagePercentage >= 80;

  const expiryDate = nextBillingOverride?.date
    ? nextBillingOverride.date.toISOString()
    : subscriptionStatus.is_trial
      ? subscriptionStatus.trial_end_date || subscriptionStatus.end_date
      : subscriptionStatus.subscription_end_date || subscriptionStatus.end_date;

  const daysRemaining =
    nextBillingOverride != null ? nextBillingOverride.daysRemaining : subscriptionStatus.days_until_expiry;
  const showNextBillingLoading = nextBillingLoading && nextBillingOverride == null;
  const isExpired = subscriptionStatus.is_expired || daysRemaining < 0;

  const billingLabel =
    subscriptionStatus.billing_cycle === "yearly"
      ? t("subscription.overview.billingCycleYearly")
      : t("subscription.overview.billingCycleMonthly");

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t("subscription.overview.currentSubscriptionTitle")}
              {subscriptionStatus.is_trial && <Badge variant="secondary">{t("subscription.overview.card.trial")}</Badge>}
            </CardTitle>
            <CardDescription>
              {subscriptionStatus.plan_name} {t("subscription.overview.subscriptionWord")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 md:gap-y-6">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">{t("subscription.overview.employeeUsage")}</span>
              {isNearLimit && <AlertTriangle className="h-4 w-4 shrink-0 text-brand-red" />}
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-foreground">
                {t("subscription.overview.employeeUsageOf", {
                  current: subscriptionStatus.current_employees,
                  max: maxEmployees,
                })}{" "}
                <span className={`tabular-nums ${isNearLimit ? "text-brand-red" : "text-muted-foreground"}`}>
                  ({Math.round(employeeUsagePercentage)}%)
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${isNearLimit ? "bg-brand-red" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, employeeUsagePercentage)}%` }}
                />
              </div>
              {subscriptionStatus.over_limit && (
                <p className="text-xs text-destructive">{t("subscription.overview.overLimit")}</p>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">
                {subscriptionStatus.is_trial
                  ? t("subscription.overview.trialPeriod")
                  : t("subscription.overview.subscriptionPeriod")}
              </span>
            </div>
            <div className="text-sm">
              <p className="text-foreground">
                {subscriptionStatus.is_trial ? t("subscription.overview.endsOn") : t("subscription.overview.renewsOn")}{" "}
                {showNextBillingLoading ? "…" : expiryDate && formatDate(expiryDate)}
              </p>
              <p
                className={`text-xs ${(daysRemaining || 0) <= 3 && !isExpired ? "text-destructive" : "text-muted-foreground"}`}
              >
                {showNextBillingLoading
                  ? t("subscription.overview.loadingShort")
                  : daysRemaining < 0
                    ? t("subscription.overview.expiredDaysAgo", { count: Math.abs(daysRemaining) })
                    : daysRemaining === 0
                      ? t("subscription.overview.expiresToday")
                      : t("subscription.overview.daysRemainingCount", { count: daysRemaining })}
              </p>
            </div>
          </div>

          {!subscriptionStatus.is_trial && (
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{t("subscription.overview.billing")}</span>
              </div>
              <div className="text-sm">
                <p className="text-foreground">{billingLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {showNextBillingLoading
                    ? t("subscription.overview.loadingShort")
                    : nextBillingOverride?.date
                      ? t("subscription.overview.nextPaymentOn", {
                          date: formatDate(nextBillingOverride.date.toISOString()),
                        })
                      : subscriptionStatus.next_payment_date
                        ? t("subscription.overview.nextPaymentOn", {
                            date: formatDate(subscriptionStatus.next_payment_date),
                          })
                        : subscriptionStatus.subscription_end_date
                          ? t("subscription.overview.nextPaymentOn", {
                              date: formatDate(subscriptionStatus.subscription_end_date),
                            })
                          : t("subscription.overview.nextPaymentDue")}
                </p>
              </div>
            </div>
          )}

          <div
            className={`min-w-0 space-y-2 ${subscriptionStatus.is_trial ? "md:col-span-2" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">{t("subscription.overview.addOnsTitle")}</span>
            </div>
            <div className="text-sm">
              <p className="text-foreground">
                {t("subscription.overview.omnichannelAddOnSummary", {
                  paid: subscriptionStatus.omnichannel_paid_seat_count ?? 0,
                  cap: subscriptionStatus.omnichannel_roster_seat_cap ?? 0,
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.omnichannelAddOnHint")}</p>
            </div>
          </div>
        </div>

        {isExpired ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {subscriptionStatus.is_trial
                    ? t("subscription.overview.trialExpiredAlert")
                    : t("subscription.overview.subscriptionExpiredAlert")}
                </p>
                <p className="text-xs text-destructive/90">{t("subscription.overview.choosePlanRenew")}</p>
              </div>
            </div>
          </div>
        ) : (
          (subscriptionStatus.needs_renewal || subscriptionStatus.over_limit) && (
            <div className="rounded-lg border border-brand-red/25 bg-brand-red/5 p-4 dark:border-brand-red/40 dark:bg-brand-red/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-red" />
                <div className="space-y-1">
                  {subscriptionStatus.needs_renewal && (
                    <p className="text-sm font-medium text-foreground">
                      {subscriptionStatus.is_trial
                        ? t("subscription.overview.trialExpiresSoon")
                        : t("subscription.overview.subscriptionExpiresSoon")}
                    </p>
                  )}
                  {subscriptionStatus.over_limit && (
                    <p className="text-sm font-medium text-foreground">
                      {t("subscription.overview.employeeLimitExceeded")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {subscriptionStatus.needs_renewal && t("subscription.overview.choosePlanRenew")}
                    {subscriptionStatus.over_limit && ` ${t("subscription.overview.upgradePlanEmployees")}`}
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
});
