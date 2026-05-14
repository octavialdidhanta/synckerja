import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
    skip_prorate?: boolean;
    current_plan_credit?: number;
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
  /** Add-on IDR included in the charged total (full list when not on HR prorate; prorated incremental when HR prorate applies). */
  catalogAddOnTotalIdr?: number;
  /** While Midtrans / checkout is starting — disables primary button and shows spinner. */
  isConfirmLoading?: boolean;
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
  catalogAddOnTotalIdr = 0,
  isConfirmLoading = false,
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
  const addon = Math.max(0, Math.round(Number(catalogAddOnTotalIdr)));
  const baseHrAmount = isBillingCycleUpgradeOnly
    ? fullPrice
    : isImmediateCharge && prorateAmount !== undefined && prorateAmount > 0
      ? prorateAmount
      : fullPrice;
  const totalAmount = baseHrAmount + addon;

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
          <Button
            type="button"
            variant="outline"
            disabled={isConfirmLoading}
            className="touch-manipulation transition-transform duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            disabled={isConfirmLoading}
            aria-busy={isConfirmLoading}
            className="touch-manipulation transition-[transform,filter,box-shadow] duration-150 ease-out active:scale-[0.97] active:brightness-[0.92] active:shadow-inner disabled:active:scale-100 disabled:active:brightness-100"
            onClick={onConfirm}
          >
            {isConfirmLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>{buttonText}</span>
              </>
            ) : (
              buttonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
