import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Check, type LucideIcon } from "lucide-react";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/hooks/useOptimizedSubscription";

interface PlanCardProps {
  plan: SubscriptionPlan;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  totalPrice: number;
  monthlyPrice: number;
  maxEmployees: number;
  isTrialPlan: boolean;
  isCurrent: boolean;
  isPopular: boolean;
  canChange: boolean;
  buttonText: string;
  hasBillingCycleChange: boolean;
  IconComponent: LucideIcon;
  currentMemberCount: number;
  currentEmployeeCount: number;
  isRenewEligible: boolean;
  subscriptionStatus?: {
    is_trial?: boolean;
    days_until_expiry?: number;
    billing_cycle?: string;
  };
  lastPaidAmount?: number | null;
  lastPaidMemberCount?: number | null;
  onMemberCountChange: (planId: string, count: number) => void;
  onBillingCycleChange: (planId: string, isYearly: boolean) => void;
  onUpgrade: (plan: SubscriptionPlan, memberCount: number, billingCycle: "monthly" | "yearly") => void;
  onRenew?: (plan: SubscriptionPlan, memberCount: number, billingCycle: "monthly" | "yearly") => void;
}

export const PlanCard = memo(
  ({
    plan,
    memberCount,
    billingCycle,
    totalPrice,
    monthlyPrice,
    maxEmployees,
    isTrialPlan,
    isCurrent,
    isPopular,
    canChange,
    buttonText,
    hasBillingCycleChange,
    IconComponent,
    currentMemberCount,
    currentEmployeeCount,
    isRenewEligible,
    subscriptionStatus,
    lastPaidAmount,
    lastPaidMemberCount,
    onMemberCountChange,
    onBillingCycleChange,
    onUpgrade,
    onRenew,
  }: PlanCardProps) => {
    const { t } = useTranslation();
    const isYearly = billingCycle === "yearly";
    const isComingSoon =
      plan.description?.toLowerCase().includes("coming soon") ||
      plan.description?.toLowerCase().includes("comming soon");
    const shouldRenew =
      isRenewEligible && isCurrent && memberCount === currentMemberCount && !hasBillingCycleChange;
    const handlePrimaryAction = () => {
      if (shouldRenew && onRenew) {
        onRenew(plan, memberCount, billingCycle);
      } else {
        onUpgrade(plan, memberCount, billingCycle);
      }
    };

    return (
      <Card
        className={`relative flex h-full flex-col transition-all duration-300 hover:shadow-xl ${
          isCurrent
            ? "border-2 border-brand-blue bg-brand-blue/5 shadow-lg dark:bg-brand-blue/10"
            : isPopular
              ? "border-2 border-brand-blue shadow-lg"
              : "border border-border"
        }`}
      >
        {isCurrent && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
            <Badge className="bg-brand-blue px-4 py-1 text-brand-white hover:bg-brand-blue">
              {subscriptionStatus?.is_trial
                ? t("subscription.plans.badge.trial", {
                    days: subscriptionStatus.days_until_expiry || 0,
                  })
                : t("subscription.plans.badge.current")}
            </Badge>
          </div>
        )}
        {!isCurrent && isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
            <Badge className="bg-brand-blue px-4 py-1 text-brand-white hover:bg-brand-blue">
              {t("subscription.plans.badge.popular")}
            </Badge>
          </div>
        )}

        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center">
            <div
              className={`rounded-full p-3 ${
                isCurrent
                  ? "bg-brand-blue/15 text-brand-blue dark:bg-brand-blue/20"
                  : isPopular
                    ? "bg-brand-blue/15 text-brand-blue dark:bg-brand-blue/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <IconComponent className="h-6 w-6" />
            </div>
          </div>

          <div>
            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
            <CardDescription className="mt-2 text-base">{plan.description}</CardDescription>
          </div>

          <div className="space-y-2">
            <div className="text-4xl font-bold text-foreground">{formatIDR(totalPrice)}</div>
            <div className="text-sm text-muted-foreground">
              {isYearly
                ? t("subscription.plans.pricing.perYear", { count: memberCount })
                : t("subscription.plans.pricing.perMonth", { count: memberCount })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex h-full flex-col space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("subscription.plans.memberCount.label", { count: memberCount })}
              {isTrialPlan && t("subscription.plans.memberCount.maxLabel", { max: maxEmployees })}
            </Label>
            <Slider
              value={[memberCount]}
              onValueChange={isTrialPlan ? undefined : (value) => onMemberCountChange(plan.id, value[0])}
              max={maxEmployees}
              min={1}
              step={1}
              className={isTrialPlan ? "pointer-events-none opacity-50" : "w-full"}
              disabled={isTrialPlan}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("subscription.plans.memberCount.min")}</span>
              <span>{t("subscription.plans.memberCount.maxDisplay", { max: maxEmployees })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t("subscription.plans.billingCycle.yearly")}</Label>
            <Switch
              checked={billingCycle === "yearly"}
              onCheckedChange={isTrialPlan ? undefined : (checked) => onBillingCycleChange(plan.id, checked)}
              disabled={isTrialPlan}
              className={isTrialPlan ? "pointer-events-none opacity-50" : ""}
            />
          </div>

          <div className="min-h-[120px] flex-grow space-y-3">
            <h4 className="font-medium text-foreground">{t("subscription.plans.features.title")}</h4>
            <ul className="space-y-2">
              {plan.features?.map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto">
            <Button
              className="w-full py-3 text-base font-medium"
              variant={isCurrent && memberCount === currentMemberCount ? "default" : "default"}
              onClick={handlePrimaryAction}
              disabled={
                isComingSoon ||
                !canChange ||
                (isCurrent && memberCount === currentMemberCount && !hasBillingCycleChange && !isRenewEligible)
              }
            >
              {isComingSoon ? t("subscription.plans.button.comingSoon") : buttonText}
            </Button>
            {isCurrent && (
              <div className="mt-2 text-center text-xs font-medium text-brand-blue">
                {t("subscription.plans.currentPlan.label", {
                  memberCount: currentMemberCount,
                  employeeCount: currentEmployeeCount,
                })}
              </div>
            )}
            {!canChange && isCurrent && memberCount < currentMemberCount && (
              <p className="mt-2 text-center text-xs text-brand-red">
                {t("subscription.plans.downgrade.error", { count: currentEmployeeCount })}
              </p>
            )}
          </div>

          {isYearly && plan.annual_discount_percentage != null && (
            <div className="text-center text-sm font-medium text-brand-blue">
              {t("subscription.plans.savings", { percentage: plan.annual_discount_percentage })}
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            {isCurrent && lastPaidAmount != null && lastPaidMemberCount != null && (
              <div className="flex justify-between text-brand-blue">
                <span>
                  {t("subscription.plans.lastPaidForMembers", {
                    amount: formatIDR(lastPaidAmount),
                    count: lastPaidMemberCount,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t("subscription.plans.priceBreakdown.perMember")}</span>
              <span>{formatIDR(plan.base_price_per_member)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("subscription.plans.priceBreakdown.monthlySubtotal")}</span>
              <span>{formatIDR(monthlyPrice)}</span>
            </div>
            {isYearly && plan.annual_discount_percentage != null && (
              <div className="flex justify-between text-brand-red">
                <span>
                  {t("subscription.plans.priceBreakdown.yearlyDiscount", {
                    percentage: plan.annual_discount_percentage,
                  })}
                </span>
                <span>-{formatIDR(monthlyPrice * 12 * (plan.annual_discount_percentage / 100))}</span>
              </div>
            )}
            <hr className="border-border" />
            <div className="flex justify-between font-medium text-foreground">
              <span>
                {isYearly
                  ? t("subscription.plans.priceBreakdown.totalYearly")
                  : t("subscription.plans.priceBreakdown.totalMonthly")}
              </span>
              <span>{formatIDR(totalPrice)}</span>
            </div>
          </div>

          {plan.demo_required && (
            <p className="text-center text-xs text-muted-foreground">{t("subscription.plans.demoRequired")}</p>
          )}
        </CardContent>
      </Card>
    );
  },
);

PlanCard.displayName = "PlanCard";
