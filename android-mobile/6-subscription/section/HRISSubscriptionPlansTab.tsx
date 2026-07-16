import { defaultPaidPlanMemberCount } from "@/0-onboarding/utils/subscriptionPlanUtils";
import { memo } from "react";
import { PendingChangesCard } from "@/10-subscription/plans/section/PendingChangesCard";
import { PlanCard, PlanAddOnsPanel, TrustIndicators } from "@/10-subscription/plans/section";
import { useHRISSubscriptionPlansController } from "@/10-subscription/plans/useHRISSubscriptionPlansController";
import { isEnterpriseSubscriptionPlan } from "@/10-subscription/shared/subscriptionUtils";
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
    currentPlanId,
    currentMemberCount,
    currentEmployeeCount,
    isMidtransConfirmLoading,
    proRateCalculation,
    catalogAddOnBillingChargeIdr,
    catalogAddOnForConfirmationModalIdr,
    isRenewEligibleBase,
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
    hasCheckoutableAddOnChangesForPlan,
    isMidCycleActive,
    planCardPrimaryPendingId,
    showAddOnsSidebar,
    sidebarAddOnContext,
    relocateAddOnDetailForCurrent,
    enterpriseSliderMin,
    resolvePlanSliderMinForPlan,
    resolvePlanSliderMaxForPlan,
    paidMemberFloor,
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
            const isEnterprisePlan = isEnterpriseSubscriptionPlan(plan);
            const isTrialPlan =
              !isEnterprisePlan && (plan.name === "Trial" || plan.base_price_per_member === 0);
            const maxEmployees = resolvePlanSliderMaxForPlan(plan);
            const memberSliderMin = resolvePlanSliderMinForPlan(plan);
            const isCurrent = isCurrentPlan(plan);
            const isRenewEligible = isCurrent && isRenewEligibleBase;

            const memberCount = Math.min(
              maxEmployees,
              Math.max(
                memberSliderMin,
                memberCounts[plan.id] !== undefined
                  ? memberCounts[plan.id]
                  : isCurrent
                    ? subscriptionStatus?.member_count || currentMemberCount || 1
                    : isEnterprisePlan
                      ? enterpriseSliderMin
                      : isTrialPlan
                        ? maxEmployees
                        : defaultPaidPlanMemberCount(paidMemberFloor, maxEmployees),
              ),
            );

            const billingCycle = billingCycles[plan.id] || "monthly";
            const isYearlyPlan = billingCycle === "yearly";
            const totalPrice = calculatePlanPrice(plan, memberCount, isYearlyPlan);
            const monthlyPrice = plan.base_price_per_member * memberCount;
            const IconComponent = getPlanIcon(plan.name);
            const isPopular = plan.name.toLowerCase().includes("professional");
            const canChange = isEnterprisePlan ? true : canChangePlan(plan, memberCount);
            const currentBillingCycle = subscriptionStatus?.billing_cycle || "monthly";
            const hasBillingCycleChange = isCurrent && billingCycle !== currentBillingCycle;
            const mergedAddOns = mergeSelections(plan, isCurrent, memberCount);
            const relocateAddOnDetail = isCurrent && relocateAddOnDetailForCurrent;
            const hasCheckoutableAddOnChanges = hasCheckoutableAddOnChangesForPlan(
              plan,
              memberCount,
              billingCycle,
              mergedAddOns,
            );

            return (
              <div key={plan.id} className="space-y-1 [&_.rounded-lg]:rounded-2xl">
                <PlanCard
                  plan={plan}
                  memberCount={memberCount}
                  billingCycle={billingCycle}
                  totalPrice={totalPrice}
                  monthlyPrice={monthlyPrice}
                  maxEmployees={maxEmployees}
                  memberSliderMin={memberSliderMin}
                  isTrialPlan={isTrialPlan}
                  isEnterprisePlan={isEnterprisePlan}
                  isCurrent={isCurrent}
                  isPopular={isPopular}
                  canChange={canChange}
                  buttonText={getButtonText(
                    plan,
                    memberCount,
                    billingCycle,
                    isRenewEligible,
                    hasCheckoutableAddOnChanges,
                    mergedAddOns,
                  )}
                  hasBillingCycleChange={hasBillingCycleChange}
                  hasCheckoutableAddOnChanges={hasCheckoutableAddOnChanges}
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
                  hideInlineAddOns={isEnterprisePlan || (isCurrent && showAddOnsSidebar)}
                  showCompactAddOnSummary={isCurrent && showAddOnsSidebar && !relocateAddOnDetail}
                  relocateAddOnDetail={relocateAddOnDetail}
                  isMidCycleActive={isMidCycleActive}
                />
              </div>
            );
          })}

          {sidebarAddOnContext ? (
            <div className="space-y-1 rounded-2xl border border-border bg-card p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("subscription.plans.sidebar.addOns.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("subscription.plans.sidebar.addOns.description")}
              </p>
              <PlanAddOnsPanel
                embeddedInSidebar
                plan={sidebarAddOnContext.plan}
                memberCount={sidebarAddOnContext.memberCount}
                billingCycle={sidebarAddOnContext.billingCycle}
                addOnSelections={sidebarAddOnContext.mergedAddOns}
                onAddOnIncludedChange={(code, inc) =>
                  handleAddOnIncludedChange(sidebarAddOnContext.plan.id, code, inc)
                }
                onAddOnQuantityChange={(code, qty) =>
                  handleAddOnQuantityChange(
                    sidebarAddOnContext.plan.id,
                    code,
                    qty,
                    sidebarAddOnContext.memberCount,
                  )
                }
                omnichannelPaidSeats={omnichannelPaidSeats}
                omnichannelRosterActiveCount={rosterCount}
                leadMagnetActive={subscriptionStatus?.lead_magnet_active ?? false}
                isMidCycleActive={isMidCycleActive}
                isTrialPlan={sidebarAddOnContext.isTrialPlan}
                isExpired={subscriptionStatus?.is_expired ?? false}
              />
            </div>
          ) : null}
        </div>

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
