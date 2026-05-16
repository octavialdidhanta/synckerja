import { memo } from "react";
import { Link } from "react-router-dom";
import { PendingChangesCard } from "@/10-subscription/plans/section/PendingChangesCard";
import { PlanCard, TrustIndicators } from "@/10-subscription/plans/section";
import { useHRISSubscriptionPlansController } from "@/10-subscription/plans/useHRISSubscriptionPlansController";
import {
  formatIDR,
  getOmnichannelAddonMonthlyTotalIdr,
  planEligibleForOmnichannelAddonDisplay,
} from "@/10-subscription/shared/subscriptionUtils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/mobile-app/components/ui/card";
import { MobileUpgradeConfirmationModal } from "./modal/MobileUpgradeConfirmationModal";
import { MobileUpgradeOptionsModal } from "./modal/MobileUpgradeOptionsModal";

interface HRISSubscriptionPlansTabProps {
  refetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const HRISSubscriptionPlansTab = ({ refetchRef }: HRISSubscriptionPlansTabProps) => {
  const {
    t,
    plansError,
    activePlans,
    subscriptionStatus,
    subscriptionPlans,
    memberCounts,
    billingCycles,
    isYearly,
    selectedPlan,
    selectedMemberCount,
    isModalOpen,
    setIsModalOpen,
    isOptionsModalOpen,
    setIsOptionsModalOpen,
    proRatedData,
    lastPaidAmount,
    lastPaidMemberCount,
    omnichannelPaidSeats,
    rosterCount,
    showOmnichannelAddonInsideScaleUpCard,
    globalOmnichannelUnitPrice,
    currentPlanId,
    currentMemberCount,
    currentEmployeeCount,
    isMidtransConfirmLoading,
    proRateCalculation,
    catalogAddOnBillingChargeIdr,
    catalogAddOnForConfirmationModalIdr,
    isRenewEligibleBase,
    getEmployeeLimitFromFeatures,
    isCurrentPlan,
    calculatePlanPrice,
    handleMemberCountChange,
    handleBillingCycleChange,
    handleAddOnIncludedChange,
    handleAddOnQuantityChange,
    mergeSelections,
    handleUpgrade,
    handleRenew,
    handleConfirmUpgrade,
    handleChooseImmediate,
    handleChooseScheduled,
    getPlanIcon,
    canChangePlan,
    getButtonText,
    planCardPrimaryPendingId,
  } = useHRISSubscriptionPlansController({ refetchRef });

  if (plansError) {
    return (
      <Card className="border border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("subscription.plans.error.loadFailed")}
          </CardTitle>
          <CardDescription>{t("subscription.plans.error.loadFailedDescription")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <PendingChangesCard />

        <div className="space-y-1">
          {activePlans.map((plan) => {
            const isTrialPlan = plan.name === "Trial" || plan.base_price_per_member === 0;
            const maxEmployees = isTrialPlan ? getEmployeeLimitFromFeatures(plan.features) : 100;
            const isCurrent = isCurrentPlan(plan);
            const isRenewEligible = isCurrent && isRenewEligibleBase;

            const memberCount =
              memberCounts[plan.id] !== undefined
                ? memberCounts[plan.id]
                : isCurrent
                  ? subscriptionStatus?.member_count || currentMemberCount || 1
                  : isTrialPlan
                    ? maxEmployees
                    : 5;

            const billingCycle = billingCycles[plan.id] || "monthly";
            const isYearlyPlan = billingCycle === "yearly";
            const totalPrice = calculatePlanPrice(plan, memberCount, isYearlyPlan);
            const monthlyPrice = plan.base_price_per_member * memberCount;
            const IconComponent = getPlanIcon(plan.name);
            const isPopular = plan.name.toLowerCase().includes("professional");
            const canChange = canChangePlan(plan, memberCount);
            const buttonText = getButtonText(plan, memberCount, billingCycle, isRenewEligible);
            const currentBillingCycle = subscriptionStatus?.billing_cycle || "monthly";
            const hasBillingCycleChange = isCurrent && billingCycle !== currentBillingCycle;
            const mergedAddOns = mergeSelections(plan, isCurrent, memberCount);

            return (
              <div key={plan.id} className="[&_.rounded-lg]:rounded-2xl">
                <PlanCard
                  plan={plan}
                  memberCount={memberCount}
                  billingCycle={billingCycle}
                  totalPrice={totalPrice}
                  monthlyPrice={monthlyPrice}
                  maxEmployees={maxEmployees}
                  isTrialPlan={isTrialPlan}
                  isCurrent={isCurrent}
                  isPopular={isPopular}
                  canChange={canChange}
                  buttonText={buttonText}
                  hasBillingCycleChange={hasBillingCycleChange}
                  IconComponent={IconComponent}
                  currentMemberCount={currentMemberCount}
                  currentEmployeeCount={currentEmployeeCount}
                  isRenewEligible={isRenewEligible}
                  subscriptionStatus={subscriptionStatus}
                  lastPaidAmount={isCurrent ? lastPaidAmount : undefined}
                  lastPaidMemberCount={isCurrent ? lastPaidMemberCount : undefined}
                  addOnSelections={mergedAddOns}
                  onAddOnIncludedChange={(code, inc) => handleAddOnIncludedChange(plan.id, code, inc)}
                  onAddOnQuantityChange={(code, qty) =>
                    handleAddOnQuantityChange(plan.id, code, qty, memberCount)
                  }
                  omnichannelPaidSeats={omnichannelPaidSeats}
                  omnichannelRosterActiveCount={rosterCount}
                  onRenew={handleRenew}
                  onMemberCountChange={handleMemberCountChange}
                  onBillingCycleChange={handleBillingCycleChange}
                  onUpgrade={handleUpgrade}
                  isPrimaryActionLoading={
                    planCardPrimaryPendingId === plan.id &&
                    (proRateCalculation.isPending || isMidtransConfirmLoading)
                  }
                />
              </div>
            );
          })}
        </div>

        {activePlans.some((p) => planEligibleForOmnichannelAddonDisplay(p)) &&
          !showOmnichannelAddonInsideScaleUpCard && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <h3 className="font-semibold text-foreground">
                {t("subscription.plans.omnichannelAddonTitle")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("subscription.plans.omnichannelAddonSubtitle", {
                  amount: formatIDR(globalOmnichannelUnitPrice),
                })}
              </p>
              <p className="mt-2 text-foreground">
                {t("subscription.plans.omnichannelPaidSeatsEntitled", { count: omnichannelPaidSeats })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("subscription.plans.omnichannelRosterActiveLine", { count: rosterCount })}
              </p>
              <p className="mt-1 text-foreground">
                {t("subscription.plans.omnichannelMonthlyLine", {
                  amount: formatIDR(
                    getOmnichannelAddonMonthlyTotalIdr(omnichannelPaidSeats, globalOmnichannelUnitPrice),
                  ),
                })}
              </p>
              <Link
                to="/omnichannel/settings"
                className="mt-2 inline-block text-xs font-medium text-primary underline"
              >
                {t("subscription.plans.manageRosterLink")}
              </Link>
            </div>
          )}

        <TrustIndicators />
      </div>

      {selectedPlan && subscriptionStatus && (
        <MobileUpgradeConfirmationModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onConfirm={handleConfirmUpgrade}
          currentPlan={
            subscriptionPlans?.find((p) => p.name === subscriptionStatus.plan_name) || selectedPlan
          }
          newPlan={selectedPlan}
          subscriptionStatus={subscriptionStatus}
          billingCycle={isYearly ? "yearly" : "monthly"}
          currentMemberCount={subscriptionStatus.member_count || 0}
          newMemberCount={selectedMemberCount}
          proRatedData={proRatedData ?? undefined}
          isLoading={isMidtransConfirmLoading}
          isBillingCycleUpgradeOnly={
            currentPlanId === selectedPlan.id &&
            currentMemberCount === selectedMemberCount &&
            (subscriptionStatus.billing_cycle || "monthly") === "monthly" &&
            isYearly
          }
          catalogAddOnChargeIdr={catalogAddOnForConfirmationModalIdr}
        />
      )}

      <MobileUpgradeOptionsModal
        open={isOptionsModalOpen}
        onOpenChange={setIsOptionsModalOpen}
        onChooseImmediate={handleChooseImmediate}
        onChooseScheduled={handleChooseScheduled}
        immediateAmount={(proRatedData?.calculation?.prorate_amount ?? 0) + catalogAddOnBillingChargeIdr}
        scheduledDate={proRatedData?.calculation?.scheduled_date || ""}
        planName={selectedPlan?.name || ""}
        currentPlanName={proRatedData?.current_plan?.name || subscriptionStatus?.plan_name || ""}
        memberChange={{
          from: proRatedData?.current_plan?.member_count || subscriptionStatus?.member_count || 0,
          to: selectedMemberCount,
        }}
        proRateData={
          proRatedData?.calculation
            ? {
                remainingDays: proRatedData.calculation.remaining_days,
                proRatePercentage: proRatedData.calculation.prorate_percentage ?? 0,
                memberCostIncrease: proRatedData.calculation.member_change_charge ?? proRatedData.calculation.prorate_amount,
                currentPlanCredit: Number(
                  (proRatedData.calculation as { current_plan_credit?: number }).current_plan_credit ?? 0,
                ),
              }
            : undefined
        }
      />
    </>
  );
};

export default memo(HRISSubscriptionPlansTab);
