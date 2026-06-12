import { AlertTriangle, Calendar, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

export type SubscriptionBannerProps = {
  subscriptionStatus: SubscriptionStatus;
  canRenew?: boolean;
  placement?: "inline" | "sticky";
  className?: string;
};

export function SubscriptionBanner({
  subscriptionStatus,
  canRenew = true,
  placement = "inline",
  className,
}: SubscriptionBannerProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const expiryDate = subscriptionStatus.is_trial
    ? subscriptionStatus.trial_end_date
    : subscriptionStatus.subscription_end_date;

  const daysLeft = subscriptionStatus.days_until_expiry || 0;
  const isUrgent = daysLeft <= 1;

  const expiryMessage =
    daysLeft < 0
      ? t("subscription.banner.expired", "Subscription expired")
      : daysLeft === 0
        ? t("subscription.banner.expiresToday", "Expires today")
        : daysLeft === 1
          ? t("subscription.banner.expiresTomorrow", "Expires tomorrow")
          : t("subscription.banner.expiresInDays", "Expires in {{count}} days", { count: daysLeft });

  const secondaryMessage = subscriptionStatus.is_trial
    ? t("subscription.banner.trialEnds", "Trial ends")
    : t("subscription.banner.subscriptionEnds", "Subscription ending soon");

  return (
    <Alert
      className={cn(
        cnBorder(isUrgent),
        placement === "sticky" && "rounded-none shadow-sm",
        className,
      )}
    >
      <AlertTriangle className={cnIcon(isUrgent)} />
      <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={cnTitle(isUrgent)}>
            {subscriptionStatus.is_trial
              ? t("subscription.banner.trialLabel", "Trial")
              : t("subscription.banner.subscriptionLabel", "Subscription")}
            {" "}
            {expiryMessage}
          </p>
          <p className={cnSub(isUrgent)}>
            <Calendar className="mr-1 inline h-3 w-3" />
            {secondaryMessage}
            {expiryDate ? ` ${formatDate(expiryDate)}` : ""}
          </p>
          {!canRenew ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "subscription.banner.contactAdminToRenew",
                "Contact your organization Owner or Admin to renew the subscription.",
              )}
            </p>
          ) : null}
        </div>
        {canRenew ? (
          <Button
            type="button"
            size="sm"
            onClick={() => navigate("/subscription/plans")}
            className={cn("shrink-0 text-white", cnBtn(isUrgent))}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {subscriptionStatus.is_trial
              ? t("subscription.banner.choosePlan", "Choose Plan")
              : t("subscription.banner.renew", "Renew")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function cnBorder(urgent: boolean) {
  return urgent
    ? "m-0 rounded-none border-x-0 border-t-0 border-b border-l-4 border-l-brand-red bg-brand-red/10 dark:bg-brand-red/15"
    : "m-0 rounded-none border-x-0 border-t-0 border-b border-l-4 border-l-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10";
}

function cnIcon(urgent: boolean) {
  return urgent ? "h-4 w-4 text-brand-red" : "h-4 w-4 text-brand-blue";
}

function cnTitle(urgent: boolean) {
  return urgent
    ? "text-sm font-semibold text-brand-red dark:text-brand-red"
    : "text-sm font-semibold text-brand-blue dark:text-brand-blue";
}

function cnSub(urgent: boolean) {
  return urgent ? "text-xs text-brand-red/90" : "text-xs text-muted-foreground";
}

function cnBtn(urgent: boolean) {
  return urgent ? "bg-brand-red hover:bg-brand-red/90" : "bg-brand-blue hover:bg-brand-blue/90";
}
