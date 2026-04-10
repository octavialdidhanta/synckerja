import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Badge } from "@/mobile/components/ui/badge";
import { Progress } from "@/mobile/components/ui/progress";
import { Button } from "@/mobile/components/ui/button";
import { RefreshCw, Users, CalendarDays, ShieldCheck } from "lucide-react";
import type { SubscriptionStatus } from "@/features/10-management/hooks/useOptimizedSubscription";
import { formatSubscriptionDate } from "@/features/10-management/utils/dateUtils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface MobileCurrentPlanCardProps {
  subscriptionStatus: SubscriptionStatus;
  onRefresh: () => void;
  isRefreshing?: boolean;
  /** Override next billing date/days to match Payment History logic (sync with desktop) */
  nextBillingOverride?: { date: Date | null; daysRemaining: number } | null;
  /** When true and no override, show loading for next/ends (avoids wrong RPC date) */
  nextBillingLoading?: boolean;
}

export const MobileCurrentPlanCard = memo(
  ({ subscriptionStatus, onRefresh, isRefreshing, nextBillingOverride, nextBillingLoading }: MobileCurrentPlanCardProps) => {
    const { t } = useAppTranslation();
    const usagePercent =
      subscriptionStatus.member_count > 0
        ? Math.min(
            100,
            Math.round(
              ((subscriptionStatus.current_employees || 0) / subscriptionStatus.member_count) * 100,
            ),
          )
        : 0;

    const statusBadge = subscriptionStatus.is_active
      ? { label: t("subscription.management.statusActive"), className: "bg-green-500 text-white" }
      : subscriptionStatus.is_trial
        ? { label: t("subscription.management.statusTrial"), className: "bg-blue-500 text-white" }
        : { label: t("subscription.management.statusInactive"), className: "bg-destructive text-destructive-foreground" };

    return (
      <Card className="border border-border">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base text-foreground">{t("subscription.management.cardTitle")}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {t("subscription.management.cardDescription")}
              </CardDescription>
            </div>
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 px-3 pb-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5">
            <div className="flex items-center gap-3 text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("subscription.management.planActive")}</p>
                <p className="text-sm font-semibold text-foreground">
                  {subscriptionStatus.plan_name || t("subscription.management.noPlan")}
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-full"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="space-y-1.5 rounded-xl border border-border bg-card/60 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("subscription.management.usageMember")}
                </p>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {subscriptionStatus.current_employees}/{subscriptionStatus.member_count}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <p className="text-[11px] text-muted-foreground">
              {usagePercent >= 80
                ? t("subscription.management.nearLimit")
                : t("subscription.management.capacityAvailable")}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("subscription.management.paymentModel")}</span>
              <span className="font-semibold text-foreground capitalize">
                {subscriptionStatus.billing_cycle || t("subscription.management.monthly")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("subscription.management.endsOn")}</span>
              <span className="font-semibold text-foreground">
                {nextBillingLoading && !nextBillingOverride
                  ? "..."
                  : formatSubscriptionDate(
                      nextBillingOverride?.date?.toISOString() ?? subscriptionStatus.subscription_end_date ?? subscriptionStatus.end_date,
                      { month: "long" },
                    )}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-card p-2.5 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold text-foreground">{t("subscription.management.nextPayment")}</p>
                <p>
                  {nextBillingLoading && !nextBillingOverride
                    ? "..."
                    : formatSubscriptionDate(
                        nextBillingOverride?.date?.toISOString() ?? subscriptionStatus.next_payment_date,
                        { month: "long" },
                      )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

MobileCurrentPlanCard.displayName = "MobileCurrentPlanCard";

