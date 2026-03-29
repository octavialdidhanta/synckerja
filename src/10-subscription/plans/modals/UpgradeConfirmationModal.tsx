import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/hooks/useOptimizedSubscription";
import { getMonthlyPriceForMembers, getYearlyPriceForMembers } from "@/10-subscription/shared/subscriptionUtils";

export interface ProRatedData {
  current_plan: {
    id?: string;
    name: string;
    member_count: number;
    base_price_per_member?: number;
    billing_cycle?: string;
    end_date?: string;
  };
  target_plan: { id?: string; name: string; base_price_per_member?: number };
  calculation?: {
    new_member_count: number;
    member_difference?: number;
    remaining_days: number;
    prorate_amount: number;
    charge_now: boolean;
    change_type: string;
    scheduled_date: string;
    is_plan_change: boolean;
    is_upgrade?: boolean;
    prorate_percentage?: number;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  subscriptionStatus: Record<string, unknown>;
  billingCycle: "monthly" | "yearly";
  currentMemberCount: number;
  newMemberCount: number;
  currentEmployeeCount?: number;
  proRatedData?: ProRatedData | null;
  isBillingCycleUpgradeOnly?: boolean;
}

export function UpgradeConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  currentPlan,
  newPlan,
  billingCycle,
  newMemberCount,
  proRatedData,
  isBillingCycleUpgradeOnly = false,
}: Props) {
  const { t } = useTranslation();
  const isYearly = billingCycle === "yearly";

  const isProRate = proRatedData?.calculation;
  const isScheduledChange = isProRate && proRatedData.calculation && !proRatedData.calculation.charge_now;
  const isImmediateCharge = isProRate && proRatedData.calculation && proRatedData.calculation.charge_now;
  const prorateAmount = proRatedData?.calculation?.prorate_amount;
  const fullPrice = isYearly
    ? getYearlyPriceForMembers(
        newPlan.base_price_per_member,
        newMemberCount,
        newPlan.annual_discount_percentage,
      )
    : getMonthlyPriceForMembers(newPlan.base_price_per_member, newMemberCount);
  const totalAmount =
    isImmediateCharge && prorateAmount !== undefined && prorateAmount > 0 ? prorateAmount : fullPrice;

  const title = isScheduledChange
    ? t("subscription.plans.modal.title.schedule")
    : isBillingCycleUpgradeOnly
      ? t("subscription.plans.modal.title.confirmYearly")
      : t("subscription.plans.modal.title.confirm");

  const buttonText = isScheduledChange
    ? t("subscription.plans.modal.button.schedule")
    : t("subscription.plans.modal.button.confirmPay");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("subscription.plans.modal.summaryPlan", {
              from: currentPlan.name,
              to: newPlan.name,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            {t("subscription.plans.modal.summaryPlan", {
              from: currentPlan.name,
              to: newPlan.name,
            })}
          </p>
          <p>
            {t("subscription.plans.modal.summaryMembers", {
              count: newMemberCount,
            })}
          </p>
          {proRatedData?.calculation && (
            <p>
              {t("subscription.plans.modal.summaryProrate", {
                days: proRatedData.calculation.remaining_days,
                amount: formatIDR(totalAmount),
              })}
            </p>
          )}
          {!isScheduledChange && (
            <p className="font-semibold text-foreground">{t("subscription.plans.modal.amount", { amount: formatIDR(totalAmount) })}</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
