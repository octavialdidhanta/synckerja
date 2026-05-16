import { Link } from "react-router-dom";
import { UpgradeConfirmationModal } from "@/10-subscription/plans/modals/UpgradeConfirmationModal";
import { PendingChangesCard } from "@/10-subscription/plans/section/PendingChangesCard";
import { UpgradeOptionsModal } from "@/10-subscription/plans/modals/UpgradeOptionsModal";
import { PlanCard, TrustIndicators } from "@/10-subscription/plans/section";
import { useHRISSubscriptionPlansController } from "@/10-subscription/plans/useHRISSubscriptionPlansController";
import {
  formatIDR,
  getOmnichannelAddonMonthlyTotalIdr,
  planEligibleForOmnichannelAddonDisplay,
} from "@/10-subscription/shared/subscriptionUtils";

const HRISSubscriptionPlansTab = () => {
  const {
    t,
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
  } = useHRISSubscriptionPlansController();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden">
      {/* Main Content Section — align with /subscription/overview */}
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-9">
        <div className="flex max-md:min-h-[360px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {/* Content Header */}
            <div className="flex-shrink-0 border-b border-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground">{t("subscription.plans.title")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("subscription.plans.description")}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content - single scroll per panel (rule 3.1) */}
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="p-4 space-y-4">
                {/* Pending Changes Card */}
                <PendingChangesCard />

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {activePlans.map((plan) => {
                    const isTrialPlan = plan.name === 'Trial' || plan.base_price_per_member === 0;
                    const maxEmployees = isTrialPlan ? getEmployeeLimitFromFeatures(plan.features) : 100;
                    const isCurrent = isCurrentPlan(plan);
                    const isRenewEligible = isCurrent && isRenewEligibleBase;
                    
                    // Use memberCounts state value for slider - this makes it interactive
                    // Only use fallback if memberCounts[plan.id] is undefined
                    const memberCount = memberCounts[plan.id] !== undefined 
                      ? memberCounts[plan.id]
                      : (isCurrent 
                          ? (subscriptionStatus?.member_count || currentMemberCount || 1)
                          : (isTrialPlan ? maxEmployees : 5)
                        );
                      
                    const billingCycle = billingCycles[plan.id] || 'monthly';
                    const isYearly = billingCycle === 'yearly';
                    const totalPrice = calculatePlanPrice(plan, memberCount, isYearly);
                    const monthlyPrice = plan.base_price_per_member * memberCount;
                    const IconComponent = getPlanIcon(plan.name);
                    
                    const isPopular = plan.name.toLowerCase().includes('professional');
                    const canChange = canChangePlan(plan, memberCount);
                    const buttonText = getButtonText(plan, memberCount, billingCycle, isRenewEligible);
                    const currentBillingCycle = subscriptionStatus?.billing_cycle || 'monthly';
                    const hasBillingCycleChange = isCurrent && billingCycle !== currentBillingCycle;

                    const mergedAddOns = mergeSelections(plan, isCurrent, memberCount);

                    return (
                      <PlanCard
                        key={plan.id}
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
                    );
                  })}
                </div>

                {activePlans.some((p) => planEligibleForOmnichannelAddonDisplay(p)) &&
                  !showOmnichannelAddonInsideScaleUpCard && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                    <h3 className="font-semibold text-foreground">{t("subscription.plans.omnichannelAddonTitle")}</h3>
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
                      <Link to="/omnichannel/settings" className="mt-2 inline-block text-xs font-medium text-primary underline">
                        {t("subscription.plans.manageRosterLink")}
                      </Link>
                    </div>
                  )}

                {/* Trust Indicators */}
                <TrustIndicators />
              </div>
            </div>

            {/* Content Footer — same shell as subscription overview footers */}
            <div className="flex min-h-10 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
              <div className="flex min-h-7 w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t("subscription.plans.footer.showing", { count: activePlans.length || 0 })}</span>
                <span>
                  {t("subscription.plans.footer.lastUpdated", {
                    time: new Date().toLocaleTimeString(),
                  })}
                </span>
              </div>
            </div>
        </div>
      </div>

      {/* Sidebar Section */}
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-3">
        <div className="flex max-md:min-h-[280px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {/* Sidebar Header */}
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">{t("subscription.plans.comparison.title")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("subscription.plans.comparison.description")}</p>
          </div>

          {/* Scrollable Sidebar Content - single scroll per panel (rule 3.1) */}
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4">
              {/* Current Plan Summary */}
              {subscriptionStatus && (
                <div className="rounded-lg border border-brand-blue/25 bg-brand-blue/5 p-3 dark:bg-brand-blue/10">
                  <h4 className="mb-2 text-sm font-medium text-foreground">{t("subscription.plans.comparison.currentPlan")}</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("subscription.plans.comparison.plan")}</span>
                      <span className="font-medium">{subscriptionStatus.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("subscription.plans.comparison.members")}</span>
                      <span className="font-medium">{subscriptionStatus.member_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("subscription.plans.comparison.billing")}</span>
                      <span className="font-medium capitalize">{subscriptionStatus.billing_cycle}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-gray-900">{t("subscription.plans.comparison.quickStats")}</div>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>{t("subscription.plans.comparison.totalPlans")}</span>
                    <span className="font-medium">{activePlans.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("subscription.plans.comparison.currentEmployees")}</span>
                    <span className="font-medium">{currentEmployeeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("subscription.plans.comparison.activeFeatures")}</span>
                    <span className="font-medium">{activePlans.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Footer — match overview sidebar footer bar */}
          <div className="flex min-h-10 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
            <div className="flex min-h-7 w-full items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("subscription.plans.comparison.footer.livePricing")}</span>
              <span className="text-muted-foreground/80">{t("subscription.plans.comparison.footer.realTime")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Confirmation Modal */}
      {selectedPlan && subscriptionStatus && (
        <UpgradeConfirmationModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onConfirm={handleConfirmUpgrade}
          currentPlan={subscriptionPlans?.find(p => p.name === subscriptionStatus?.plan_name) || selectedPlan}
          newPlan={selectedPlan}
          subscriptionStatus={subscriptionStatus}
          billingCycle={isYearly ? 'yearly' : 'monthly'}
          currentMemberCount={subscriptionStatus?.member_count}
          newMemberCount={selectedMemberCount}
          currentEmployeeCount={currentEmployeeCount}
          proRatedData={proRatedData}
          isBillingCycleUpgradeOnly={
            currentPlanId === selectedPlan.id &&
            currentMemberCount === selectedMemberCount &&
            (subscriptionStatus?.billing_cycle || 'monthly') === 'monthly' &&
            isYearly
          }
          catalogAddOnTotalIdr={catalogAddOnForConfirmationModalIdr}
          isConfirmLoading={isMidtransConfirmLoading}
        />
      )}

      <UpgradeOptionsModal
        open={isOptionsModalOpen}
        onOpenChange={setIsOptionsModalOpen}
        onChooseImmediate={handleChooseImmediate}
        onChooseScheduled={handleChooseScheduled}
        immediateAmount={(proRatedData?.calculation?.prorate_amount ?? 0) + catalogAddOnBillingChargeIdr}
        scheduledDate={proRatedData?.calculation?.scheduled_date || ''}
        planName={selectedPlan?.name || ''}
        currentPlanName={proRatedData?.current_plan?.name || subscriptionStatus?.plan_name || 'Unknown Plan'}
        memberChange={{
          from: proRatedData?.current_plan?.member_count || subscriptionStatus?.member_count || 0,
          to: selectedMemberCount
        }}
        proRateData={
          proRatedData?.calculation
            ? {
                remainingDays: proRatedData.calculation.remaining_days,
                proRatePercentage: proRatedData.calculation.prorate_percentage ?? 0,
                memberCostIncrease: proRatedData.calculation.prorate_amount ?? 0,
                currentPlanCredit: Number(
                  (proRatedData.calculation as { current_plan_credit?: number }).current_plan_credit ?? 0,
                ),
                skipProrate: Boolean(proRatedData.calculation.skip_prorate),
              }
            : undefined
        }
      />
    </div>
  );
};

export default HRISSubscriptionPlansTab;
