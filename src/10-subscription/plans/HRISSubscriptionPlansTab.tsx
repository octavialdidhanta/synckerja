import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Users, Shield, Star } from "lucide-react";
import { toast } from "sonner";
import { useSubscriptionPlans } from "@/10-subscription/hooks/useSubscriptionPlans";
import {
  useOptimizedSubscription,
  type SubscriptionPlan,
} from "@/10-subscription/hooks/useOptimizedSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useLastPaidSubscription } from "@/10-subscription/hooks/useLastPaidSubscription";
import { useMidtransPayment } from "@/10-subscription/hooks/useMidtransPayment";
import { useProRateCalculation } from "@/10-subscription/hooks/useProRateCalculation";
import { useEmployeeCount } from "@/10-subscription/hooks/useEmployeeCount";
import { getMonthlyPriceForMembers, getYearlyPriceForMembers } from "@/10-subscription/shared/subscriptionUtils";
import {
  UpgradeConfirmationModal,
  type ProRatedData,
} from "@/10-subscription/plans/modals/UpgradeConfirmationModal";
import { useSchedulePlanChange } from "@/10-subscription/hooks/useSchedulePlanChange";
import { PendingChangesCard } from "@/10-subscription/plans/section/PendingChangesCard";
import { UpgradeOptionsModal } from "@/10-subscription/plans/modals/UpgradeOptionsModal";
import { PlanCard, TrustIndicators } from "@/10-subscription/plans/section";
import { PageSpinner } from "@/10-subscription/shared/PageSpinner";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";

const RENEWAL_WINDOW_DAYS = 7;

type PlanChangeType = "upgrade" | "downgrade" | "member_increase" | "member_decrease" | "mixed";

function toPlanChangeType(value: unknown, fallback: PlanChangeType): PlanChangeType {
  const allowed: PlanChangeType[] = ["upgrade", "downgrade", "member_increase", "member_decrease", "mixed"];
  return typeof value === "string" && allowed.includes(value as PlanChangeType)
    ? (value as PlanChangeType)
    : fallback;
}

const HRISSubscriptionPlansTab = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [memberCounts, setMemberCounts] = useState<{ [key: string]: number }>({});
  const [billingCycles, setBillingCycles] = useState<{ [key: string]: 'monthly' | 'yearly' }>({});
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedMemberCount, setSelectedMemberCount] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [proRatedData, setProRatedData] = useState<ProRatedData | null>(null);
  
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { subscriptionStatus, subscriptionPlans } = useOptimizedSubscription();
  const { organizationId } = useActiveOrganization();
  const { lastPaidAmount, lastPaidMemberCount } = useLastPaidSubscription(organizationId ?? undefined);
  const { initiateMidtransPayment } = useMidtransPayment({
    onPaymentStatusChange: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
        queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      }
    },
  });
  const proRateCalculation = useProRateCalculation();
  const { data: currentEmployeeCount = 0 } = useEmployeeCount();

  // Get current subscription details
  const currentPlanId = subscriptionStatus?.plan_name ? 
    subscriptionPlans?.find(p => p.name === subscriptionStatus.plan_name)?.id : null;
  const currentMemberCount = subscriptionStatus?.member_count || 0;

  // Extract employee limit from plan features
  const getEmployeeLimitFromFeatures = (features: string[]) => {
    if (!features || !Array.isArray(features)) return 100;
    
    for (const feature of features) {
      // Look for patterns like "1 Member Allowed", "12 employee limit", "5 karyawan", "10 orang", etc.
      const patterns = [
        /(\d+)\s*Member\s*Allowed/i,
        /(\d+)\s*(employee\s*limit|karyawan|orang|employees?|members?)/i
      ];
      
      for (const pattern of patterns) {
        const match = feature.match(pattern);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }
    return 100; // Default fallback for non-trial plans
  };

  // Function to check if a plan is the current active plan
  const isCurrentPlan = (plan: SubscriptionPlan) => {
    if (!subscriptionStatus) return false;
    
    // Only match by exact plan name - this ensures only ONE plan is current
    return subscriptionStatus.plan_name === plan.name;
  };

  // Initialize memberCounts state properly for each plan
  useEffect(() => {
    if (!plans || !subscriptionStatus || Object.keys(memberCounts).length > 0) return;

    const newMemberCounts: { [key: string]: number } = {};

    plans.forEach(plan => {
      const isTrialPlan = plan.name === 'Trial' || plan.base_price_per_member === 0;
      const isCurrent = isCurrentPlan(plan);
      const maxEmployees = isTrialPlan ? getEmployeeLimitFromFeatures(plan.features) : 100;
      
      let defaultCount;
      if (isCurrent) {
        // For current plan, use actual subscription member count
        defaultCount = subscriptionStatus.member_count || currentMemberCount || 1;
      } else if (isTrialPlan) {
        defaultCount = maxEmployees;
      } else {
        defaultCount = 5;
      }
      
      newMemberCounts[plan.id] = defaultCount;
    });

    setMemberCounts(newMemberCounts);
    // Intentionally omit memberCounts / isCurrentPlan: one-time init when plans load; re-run would reset sliders.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [plans, subscriptionStatus, currentMemberCount]);

  const handleMemberCountChange = (planId: string, count: number) => {
    setMemberCounts(prev => ({ ...prev, [planId]: count }));
  };

  const handleBillingCycleChange = (planId: string, isYearly: boolean) => {
    setBillingCycles(prev => ({ ...prev, [planId]: isYearly ? 'yearly' : 'monthly' }));
  };

  const calculatePlanPrice = (plan: SubscriptionPlan, memberCount: number, isYearly: boolean) => {
    const basePrice = plan.base_price_per_member * memberCount;
    if (isYearly && plan.annual_discount_percentage) {
      return basePrice * 12 * (1 - plan.annual_discount_percentage / 100);
    }
    return isYearly ? basePrice * 12 : basePrice;
  };

  const handleUpgrade = useCallback(async (plan: SubscriptionPlan, memberCount: number, billingCycleOverride?: 'monthly' | 'yearly') => {
    const selectedBillingCycle = billingCycleOverride || billingCycles[plan.id] || 'monthly';

    setSelectedPlan(plan);
    setSelectedMemberCount(memberCount);
    // Update global isYearly state for modal consistency
    setIsYearly(selectedBillingCycle === 'yearly');

    try {
      // Selalu hitung prorate untuk semua skenario (plan change / member change)
      const calculation = await proRateCalculation.mutateAsync({
        new_member_count: memberCount,
        target_plan_id: plan.id,
      });

      if (calculation?.success) {
        // ✅ FIX: Jika subscription sudah expired, paksa charge_now = true
        const isExpired = subscriptionStatus?.is_expired || false;
        if (isExpired && calculation.calculation) {
          calculation.calculation.charge_now = true;
          // Set scheduled_date ke hari ini karena expired, perubahan harus langsung
          calculation.calculation.scheduled_date = new Date().toISOString();
          calculation.calculation.remaining_days = 0;
        }

        // ✅ Billing cycle upgrade only: same plan, same members, monthly→yearly.
        // Override charge_now so we show "Confirm & Pay" instead of "Schedule Member Change"
        const isBillingCycleUpgradeOnly =
          currentPlanId === plan.id &&
          currentMemberCount === memberCount &&
          (subscriptionStatus?.billing_cycle || 'monthly') === 'monthly' &&
          selectedBillingCycle === 'yearly';
        if (isBillingCycleUpgradeOnly && calculation.calculation) {
          calculation.calculation.charge_now = true;
        }

        setProRatedData(calculation as ProRatedData);

        // Check if this is a member increase (scale-up) without plan change
        const isMemberIncrease = calculation.calculation?.member_difference > 0 && 
                                !calculation.calculation?.is_plan_change;
        
        // For member increases, proceed directly with immediate payment (no scheduling options)
        if (isMemberIncrease && calculation.calculation?.charge_now) {
          setIsModalOpen(true);
        } else if (calculation.calculation?.charge_now && calculation.calculation?.prorate_amount > 0) {
          setIsOptionsModalOpen(true);
        } else {
          // For downgrades or no charge scenarios, show regular confirmation modal
          setIsModalOpen(true);
        }
      } else {
        setProRatedData(null);
        setIsModalOpen(true);
      }
    } catch {
      setProRatedData(null);
      setIsModalOpen(true);
    }
  }, [proRateCalculation, billingCycles, subscriptionStatus, currentPlanId, currentMemberCount]);

  const schedulePlanChange = useSchedulePlanChange();

  const handleRenew = useCallback(async (plan: SubscriptionPlan, memberCount: number, billingCycle: 'monthly' | 'yearly') => {
    if (!subscriptionStatus) return;

    const chargeCycle = subscriptionStatus.billing_cycle === 'yearly' ? 'yearly' : billingCycle;
    const basePrice = plan.base_price_per_member;
    const finalAmount = chargeCycle === 'yearly'
      ? getYearlyPriceForMembers(basePrice, memberCount, plan.annual_discount_percentage)
      : getMonthlyPriceForMembers(basePrice, memberCount);

    try {
      await initiateMidtransPayment({
        planId: plan.id,
        planName: plan.name,
        amount: finalAmount,
        memberCount,
        billingCycle: chargeCycle,
      });
    } catch {
      toast.error(t("subscription.plans.error.renewalFailed"));
    }
  }, [subscriptionStatus, initiateMidtransPayment, t]);

  const handleConfirmUpgrade = useCallback(async () => {
    if (!selectedPlan) return;

    try {
      // ✅ Billing cycle upgrade only: same plan, same members, monthly→yearly.
      // Skip schedule, proceed with full yearly payment (no proRateDetails)
      const isBillingCycleUpgradeOnly =
        currentPlanId === selectedPlan.id &&
        currentMemberCount === selectedMemberCount &&
        (subscriptionStatus?.billing_cycle || 'monthly') === 'monthly' &&
        isYearly;
      if (isBillingCycleUpgradeOnly) {
        const fullYearlyPrice = getYearlyPriceForMembers(
          selectedPlan.base_price_per_member,
          selectedMemberCount,
          selectedPlan.annual_discount_percentage
        );
        await initiateMidtransPayment({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: fullYearlyPrice,
          memberCount: selectedMemberCount,
          billingCycle: 'yearly',
        });
        setIsModalOpen(false);
        setSelectedPlan(null);
        setProRatedData(null);
        return;
      }

      // ✅ FIX: Jika subscription sudah expired, jangan schedule, langsung proses
      const isExpired = subscriptionStatus?.is_expired || false;
      
      // If prorate says no charge now AND subscription is NOT expired, schedule the change
      if (proRatedData?.calculation && proRatedData.calculation.charge_now === false && !isExpired) {
        await schedulePlanChange.mutateAsync({
          current_plan_id: proRatedData.current_plan.id,
          target_plan_id: proRatedData.target_plan.id,
          current_member_count: proRatedData.current_plan.member_count,
          target_member_count: proRatedData.calculation.new_member_count,
          change_type: toPlanChangeType(proRatedData.calculation.change_type, "downgrade"),
          scheduled_date: proRatedData.calculation.scheduled_date,
          prorate_amount: 0,
          charge_now: false,
        });

        setIsModalOpen(false);
        setSelectedPlan(null);
        setProRatedData(null);
        return;
      }

      // Otherwise, proceed with immediate payment (upgrade/member increase OR expired subscription)
      const basePrice = selectedPlan.base_price_per_member;
      // Use prorate_amount if it exists and > 0, otherwise use full price
      const prorateAmount = proRatedData?.calculation?.prorate_amount;
      const fullPrice = isYearly
        ? getYearlyPriceForMembers(basePrice, selectedMemberCount, selectedPlan.annual_discount_percentage)
        : getMonthlyPriceForMembers(basePrice, selectedMemberCount);
      const finalAmount = (prorateAmount !== undefined && prorateAmount > 0) ? prorateAmount : fullPrice;

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: finalAmount,
        memberCount: selectedMemberCount,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        proRateDetails: proRatedData?.calculation ? {
          is_member_upgrade: proRatedData.calculation.is_upgrade && !proRatedData.calculation.is_plan_change,
          previous_member_count: proRatedData.current_plan.member_count,
          member_difference: proRatedData.calculation.member_difference,
          remaining_days: proRatedData.calculation.remaining_days,
          prorate_amount: proRatedData.calculation.prorate_amount,
          prorate_percentage: proRatedData.calculation.prorate_percentage
        } : undefined
      });
      
      setIsModalOpen(false);
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment/schedule
    }
  }, [selectedPlan, selectedMemberCount, isYearly, initiateMidtransPayment, proRatedData, schedulePlanChange, subscriptionStatus, currentPlanId, currentMemberCount]);

  const handleChooseImmediate = useCallback(async () => {
    setIsOptionsModalOpen(false);
    
    if (!selectedPlan) return;

    try {
      // Directly proceed with immediate payment
      const basePrice = selectedPlan.base_price_per_member;
      // Use prorate_amount if it exists and > 0, otherwise use full price
      const prorateAmount = proRatedData?.calculation?.prorate_amount;
      const fullPrice = isYearly
        ? getYearlyPriceForMembers(basePrice, selectedMemberCount, selectedPlan.annual_discount_percentage)
        : getMonthlyPriceForMembers(basePrice, selectedMemberCount);
      const finalAmount = (prorateAmount !== undefined && prorateAmount > 0) ? prorateAmount : fullPrice;

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: finalAmount,
        memberCount: selectedMemberCount,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        proRateDetails: proRatedData?.calculation ? {
          is_member_upgrade: proRatedData.calculation.is_upgrade && !proRatedData.calculation.is_plan_change,
          previous_member_count: proRatedData.current_plan.member_count,
          member_difference: proRatedData.calculation.member_difference,
          remaining_days: proRatedData.calculation.remaining_days,
          prorate_amount: proRatedData.calculation.prorate_amount,
          prorate_percentage: proRatedData.calculation.prorate_percentage
        } : undefined
      });
      
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment
    }
  }, [selectedPlan, selectedMemberCount, isYearly, initiateMidtransPayment, proRatedData]);

  const handleChooseScheduled = useCallback(async () => {
    if (!selectedPlan || !proRatedData?.calculation) return;

    try {
      await schedulePlanChange.mutateAsync({
        current_plan_id: proRatedData.current_plan.id,
        target_plan_id: proRatedData.target_plan.id,
        current_member_count: proRatedData.current_plan.member_count,
        target_member_count: proRatedData.calculation.new_member_count,
        change_type: toPlanChangeType(proRatedData.calculation.change_type, "upgrade"),
        scheduled_date: proRatedData.calculation.scheduled_date,
        prorate_amount: 0,
        charge_now: false,
      });

      setIsOptionsModalOpen(false);
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from schedulePlanChange
    }
  }, [selectedPlan, proRatedData, schedulePlanChange]);

  const getPlanIcon = (planName: string) => {
    if (planName.toLowerCase().includes('basic')) return Users;
    if (planName.toLowerCase().includes('professional')) return Zap;
    if (planName.toLowerCase().includes('enterprise')) return Shield;
    return Star;
  };
  

  // Function to check if upgrade/downgrade is allowed
  const canChangePlan = (plan: SubscriptionPlan, newMemberCount: number) => {
    if (!subscriptionStatus) return true;
    
    const isCurrent = isCurrentPlan(plan);
    const currentMemberLimit = subscriptionStatus.member_count || 0;
    
    if (isCurrent) {
      // For current plan, always allow upgrade (increase member count)
      // For downgrade, check if new member count >= actual employee count
      if (newMemberCount < currentMemberLimit) {
        // This is a downgrade - check if we have enough room
        return currentEmployeeCount <= newMemberCount;
      }
      // This is an upgrade or same count - always allowed
      return true;
    }
    
    // For different plans, check if the new plan can accommodate current employees
    return currentEmployeeCount <= newMemberCount;
  };

  const getButtonText = (plan: SubscriptionPlan, memberCount: number, billingCycle: string, isRenewEligible: boolean) => {
    const isCurrent = isCurrentPlan(plan);
    const currentMemberLimit = subscriptionStatus?.member_count || 0;
    const currentBillingCycle = subscriptionStatus?.billing_cycle || 'monthly';
    
    if (isCurrent) {
      if (isRenewEligible && memberCount === currentMemberLimit && billingCycle === currentBillingCycle) {
        return t("subscription.plans.button.renew");
      }
      if (memberCount > currentMemberLimit) {
        return t("subscription.plans.button.upgrade");
      } else if (memberCount < currentMemberLimit) {
        return canChangePlan(plan, memberCount)
          ? t("subscription.plans.button.downgrade")
          : t("subscription.plans.button.cannotDowngrade");
      } else if (billingCycle !== currentBillingCycle) {
        return billingCycle === "yearly"
          ? t("subscription.plans.button.upgradeToYearly")
          : t("subscription.plans.button.switchToMonthly");
      } else {
        return t("subscription.plans.button.current");
      }
    }

    return t("subscription.plans.button.select");
  };
  
  const daysUntilExpiry = subscriptionStatus?.days_until_expiry ?? null;
  const isRenewWindow = typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && daysUntilExpiry <= RENEWAL_WINDOW_DAYS;
  // Allow renewal if: (1) within renewal window OR (2) subscription is expired (not trial)
  const isRenewEligibleBase = Boolean(subscriptionStatus) && 
    (isRenewWindow || subscriptionStatus?.is_expired) && 
    !subscriptionStatus?.is_trial;
  if (isLoading) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-9">
          <div className="flex max-md:min-h-[360px] min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-card shadow-sm md:min-h-[240px]">
            <PageSpinner />
          </div>
        </div>
        <div className="col-span-12 md:col-span-3">
          <div className="flex max-md:min-h-[280px] min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-card shadow-sm md:min-h-[240px]">
            <PageSpinner />
          </div>
        </div>
      </div>
    );
  }

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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
              <div className="p-4 space-y-4">
                {/* Pending Changes Card */}
                <PendingChangesCard />

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {plans?.map((plan) => {
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
                        onRenew={handleRenew}
                        onMemberCountChange={handleMemberCountChange}
                        onBillingCycleChange={handleBillingCycleChange}
                        onUpgrade={handleUpgrade}
                      />
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
                <span>{t("subscription.plans.footer.showing", { count: plans?.length || 0 })}</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4">
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
                    <span className="font-medium">{plans?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("subscription.plans.comparison.currentEmployees")}</span>
                    <span className="font-medium">{currentEmployeeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("subscription.plans.comparison.activeFeatures")}</span>
                    <span className="font-medium">{plans?.length || 0}</span>
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
        />
      )}

      <UpgradeOptionsModal
        open={isOptionsModalOpen}
        onOpenChange={setIsOptionsModalOpen}
        onChooseImmediate={handleChooseImmediate}
        onChooseScheduled={handleChooseScheduled}
        immediateAmount={proRatedData?.calculation?.prorate_amount || 0}
        scheduledDate={proRatedData?.calculation?.scheduled_date || ''}
        planName={selectedPlan?.name || ''}
        currentPlanName={proRatedData?.current_plan?.name || subscriptionStatus?.plan_name || 'Unknown Plan'}
        memberChange={{
          from: proRatedData?.current_plan?.member_count || subscriptionStatus?.member_count || 0,
          to: selectedMemberCount
        }}
        proRateData={{
          remainingDays: proRatedData?.calculation?.remaining_days || 31,
          proRatePercentage: proRatedData?.calculation?.prorate_percentage || 103.3,
          memberCostIncrease: proRatedData?.calculation?.prorate_amount || 0,
          currentPlanCredit: proRatedData?.calculation?.current_plan_credit || 0
        }}
      />
    </div>
  );
};

export default HRISSubscriptionPlansTab;
