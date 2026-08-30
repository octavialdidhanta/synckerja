import { UpgradeConfirmationModal } from "@/10-subscription/plans/modals/UpgradeConfirmationModal";
import { PendingChangesCard } from "@/10-subscription/plans/section/PendingChangesCard";
import { UpgradeOptionsModal } from "@/10-subscription/plans/modals/UpgradeOptionsModal";
import { PlanCard, PlanAddOnsPanel, TrustIndicators } from "@/10-subscription/plans/section";
import { useHRISSubscriptionPlansController } from "@/10-subscription/plans/useHRISSubscriptionPlansController";
import { isEnterpriseSubscriptionPlan } from "@/10-subscription/shared/subscriptionUtils";
import { defaultPaidPlanMemberCount } from "@/0-onboarding/utils/subscriptionPlanUtils";
import { usesBillingTermSelector } from "@/10-subscription/shared/billingTermUtils";

const HRISSubscriptionPlansTab = () => {
  const {
    t,
    activePlans,
    subscriptionStatus,
    subscriptionPlans,
    memberCounts,
    billingCycles,
    billingTerms,
    isYearly,
    selectedBillingTermMonths,
    currentOrgBillingTermMonths,
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
    posPaidOutletCount,
    posAddonActive,
    rosterCount,
    currentPlanId,
    currentMemberCount,
    currentEmployeeCount,
    isMidtransConfirmLoading,
    proRateCalculation,
    catalogAddOnBillingChargeIdr,
    catalogAddOnForConfirmationModalIdr,
    isRenewEligibleBase,
    enterpriseSliderMin,
    resolvePlanSliderMinForPlan,
    resolvePlanSliderMaxForPlan,
    isCurrentPlan,
    calculatePlanPrice,
    handleMemberCountChange,
    handleBillingCycleChange,
    handleBillingTermChange,
    resolveBillingForPlan,
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
    hasSchedulableDowngradeForPlan,
    isMidCycleActive,
    paidMemberFloor,
    planCardPrimaryPendingId,
    showAddOnsSidebar,
    sidebarAddOnContext,
    relocateAddOnDetailForCurrent,
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
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {activePlans.map((plan) => {
                    const isEnterprisePlan = isEnterpriseSubscriptionPlan(plan);
                    const isTrialPlan =
                      !isEnterprisePlan &&
                      (plan.name === "Trial" || plan.base_price_per_member === 0);
                    const isCurrent = isCurrentPlan(plan);
                    const maxEmployees = resolvePlanSliderMaxForPlan(plan);
                    const memberSliderMin = resolvePlanSliderMinForPlan(plan);
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

                    const { billingCycle, billingTermMonths } = resolveBillingForPlan(plan);
                    const isYearlyPlan = billingCycle === "yearly";
                    const totalPrice = calculatePlanPrice(plan, memberCount, isYearlyPlan, billingTermMonths);
                    const monthlyPrice = plan.base_price_per_member * memberCount;
                    const IconComponent = getPlanIcon(plan.name);

                    const isPopular = plan.name.toLowerCase().includes("professional");
                    const canChange = isEnterprisePlan ? true : canChangePlan(plan, memberCount);
                    const currentBillingCycle = subscriptionStatus?.billing_cycle || "monthly";
                    const hasBillingCycleChange = isCurrent && (
                      usesBillingTermSelector(plan)
                        ? billingTermMonths !== currentOrgBillingTermMonths
                        : billingCycle !== currentBillingCycle
                    );

                    const mergedAddOns = mergeSelections(plan, isCurrent, memberCount);
                    const relocateAddOnDetail = isCurrent && relocateAddOnDetailForCurrent;
                    const hasCheckoutableAddOnChanges = hasCheckoutableAddOnChangesForPlan(
                      plan,
                      memberCount,
                      billingCycle,
                      mergedAddOns,
                    );

                    const hasSchedulableDowngrade = hasSchedulableDowngradeForPlan(
                      plan,
                      memberCount,
                      billingCycle,
                      mergedAddOns,
                    );

                    return (
                      <div key={plan.id}>
                        <PlanCard
                          plan={plan}
                          memberCount={memberCount}
                          billingCycle={billingCycle}
                          billingTermMonths={billingTermMonths}
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
                            billingTermMonths,
                          )}
                          hasBillingCycleChange={hasBillingCycleChange}
                          hasCheckoutableAddOnChanges={hasCheckoutableAddOnChanges}
                          hasSchedulableDowngrade={hasSchedulableDowngrade}
                          IconComponent={IconComponent}
                          currentMemberCount={currentMemberCount}
                          currentEmployeeCount={currentEmployeeCount}
                          isRenewEligible={isRenewEligible}
                          subscriptionStatus={subscriptionStatus}
                          lastPaidAmount={isCurrent ? lastPaidAmount : undefined}
                          lastPaidMemberCount={isCurrent ? lastPaidMemberCount : undefined}
                          addOnSelections={mergedAddOns}
                          onAddOnIncludedChange={(code, inc) =>
                            handleAddOnIncludedChange(plan.id, code, inc)
                          }
                          onAddOnQuantityChange={(code, qty) =>
                            handleAddOnQuantityChange(plan.id, code, qty, memberCount)
                          }
                          omnichannelPaidSeats={omnichannelPaidSeats}
                          omnichannelRosterActiveCount={rosterCount}
                          posPaidOutletCount={posPaidOutletCount}
                          posAddonActive={posAddonActive}
                          onRenew={handleRenew}
                          onMemberCountChange={handleMemberCountChange}
                          onBillingCycleChange={handleBillingCycleChange}
                          onBillingTermChange={handleBillingTermChange}
                          onUpgrade={handleUpgrade}
                          isPrimaryActionLoading={
                            planCardPrimaryPendingId === plan.id &&
                            (proRateCalculation.isPending || isMidtransConfirmLoading)
                          }
                          hideInlineAddOns={isEnterprisePlan || (isCurrent && showAddOnsSidebar)}
                          showCompactAddOnSummary={isCurrent && showAddOnsSidebar && !relocateAddOnDetail}
                          relocateAddOnDetail={relocateAddOnDetail}
                          isMidCycleActive={isMidCycleActive}
                          paidMemberFloor={paidMemberFloor}
                        />
                      </div>
                    );
                  })}
                </div>

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

      {/* Add-ons Sidebar */}
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-3">
        <div className="flex max-md:min-h-[280px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("subscription.plans.sidebar.addOns.title")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("subscription.plans.sidebar.addOns.description")}
            </p>
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sidebarAddOnContext ? (
              <PlanAddOnsPanel
                embeddedInSidebar
                plan={sidebarAddOnContext.plan}
                memberCount={sidebarAddOnContext.memberCount}
                billingCycle={sidebarAddOnContext.billingCycle}
                billingTermMonths={sidebarAddOnContext.billingTermMonths}
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
                posPaidOutletCount={posPaidOutletCount}
                posAddonActive={posAddonActive}
                isMidCycleActive={isMidCycleActive}
                isTrialPlan={sidebarAddOnContext.isTrialPlan}
                isExpired={subscriptionStatus?.is_expired ?? false}
              />
            ) : (
              <div className="flex flex-1 flex-col p-4">
                <p className="text-sm text-muted-foreground">
                  {t("subscription.plans.sidebar.addOns.empty")}
                </p>
              </div>
            )}
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
            Boolean(selectedPlan) &&
            currentPlanId === selectedPlan.id &&
            currentMemberCount === selectedMemberCount &&
            selectedBillingTermMonths > currentOrgBillingTermMonths
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
