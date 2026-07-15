import { useState, useEffect, useCallback, useMemo, type MutableRefObject } from "react";
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
import {
  getMonthlyPriceForMembers,
  getYearlyPriceForMembers,
  formatIDR,
  buildMidtransExplicitHrAndAddonItemDetails,
  catalogAddonChargeForMidtransSplit,
  catalogAddOnListAmountForMidtransSplit,
  bundledOmnichannelRosterUnitsFromSelections,
  getOmnichannelAddonMonthlyTotalIdr,
  getOmnichannelRosterAddonConfig,
  isScaleUpSubscriptionPlanName,
  mergePlanAddOnSelections,
  planEligibleForOmnichannelAddonDisplay,
  OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY,
} from "@/10-subscription/shared/subscriptionUtils";
import { type ProRatedData } from "@/10-subscription/plans/modals/UpgradeConfirmationModal";
import { useSchedulePlanChange } from "@/10-subscription/hooks/useSchedulePlanChange";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { invalidatePlanModuleAccessForOrg } from "@/10-subscription/shared/invalidatePlanModuleAccess";
import { getPlanMaxMembers, resolvePlanSliderMax } from "@/0-onboarding/utils/subscriptionPlanUtils";
import {
  organizationOmnichannelStaffQueryKey,
  useOrganizationOmnichannelStaff,
} from "@/shared/hooks/useOrganizationOmnichannelStaff";

export const RENEWAL_WINDOW_DAYS = 7;

export type PlanChangeType = "upgrade" | "downgrade" | "member_increase" | "member_decrease" | "mixed";

function toPlanChangeType(value: unknown, fallback: PlanChangeType): PlanChangeType {
  const allowed: PlanChangeType[] = ["upgrade", "downgrade", "member_increase", "member_decrease", "mixed"];
  return typeof value === "string" && allowed.includes(value as PlanChangeType)
    ? (value as PlanChangeType)
    : fallback;
}

export type HRISSubscriptionPlansControllerOptions = {
  refetchRef?: MutableRefObject<(() => Promise<void>) | null>;
};

export function useHRISSubscriptionPlansController(
  options: HRISSubscriptionPlansControllerOptions = {},
) {
  const { refetchRef } = options;

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
  const [planAddOnUi, setPlanAddOnUi] = useState<
    Record<string, Record<string, { included: boolean; quantity: number }>>
  >({});
  /** Add-on rows shown on the card when user clicked Pilih Plan / renew (stable across async prorate). */
  const [checkoutAddOnSnapshot, setCheckoutAddOnSnapshot] = useState<{
    planId: string;
    selections: Record<string, { included: boolean; quantity: number }>;
  } | null>(null);
  /** Plan whose primary CTA (Upgrade / Renew) is awaiting prorate or Midtrans. */
  const [planCardPrimaryPendingId, setPlanCardPrimaryPendingId] = useState<string | null>(null);

  const { data: plans, error: plansError, refetch: refetchPlans } = useSubscriptionPlans();
  const { subscriptionStatus, subscriptionPlans, refreshSubscriptionStatus } = useOptimizedSubscription();
  const { organizationId } = useActiveOrganization();
  const { data: omnichannelRoster = [] } = useOrganizationOmnichannelStaff();
  const rosterCount = omnichannelRoster.length;
  const omnichannelPaidSeats = subscriptionStatus?.omnichannel_paid_seat_count ?? 0;
  /** All rows returned for `is_active = true` (no extra client-side hiding). */
  const activePlans = useMemo(() => plans ?? [], [plans]);
  const showOmnichannelAddonInsideScaleUpCard = useMemo(
    () =>
      activePlans.some(
        (p) => isScaleUpSubscriptionPlanName(p.name) && planEligibleForOmnichannelAddonDisplay(p),
      ),
    [activePlans],
  );

  /** Unit price for global add-on copy when multiple eligible plans could differ (use first eligible). */
  const globalOmnichannelUnitPrice = useMemo(() => {
    const first = activePlans.find((p) => planEligibleForOmnichannelAddonDisplay(p));
    return first
      ? getOmnichannelRosterAddonConfig(first).unitPricePerStaffMonthly
      : OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY;
  }, [activePlans]);
  const { lastPaidAmount, lastPaidMemberCount } = useLastPaidSubscription(organizationId ?? undefined);
  const { initiateMidtransPayment, isLoading: isMidtransConfirmLoading } = useMidtransPayment({
    onPaymentStatusChange: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
        queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
        queryClient.invalidateQueries({ queryKey: organizationOmnichannelStaffQueryKey(organizationId) });
        invalidatePlanModuleAccessForOrg(queryClient, organizationId);
      }
    },
  });
  const proRateCalculation = useProRateCalculation();
  const { data: currentEmployeeCount = 0 } = useEmployeeCount();

  // Get current subscription details
  const currentPlanId = subscriptionStatus?.plan_name ? 
    subscriptionPlans?.find(p => p.name === subscriptionStatus.plan_name)?.id : null;
  const currentMemberCount = subscriptionStatus?.member_count || 0;

  const resolvePlanMaxMembers = (plan: SubscriptionPlan) => getPlanMaxMembers(plan);

  // Function to check if a plan is the current active plan
  const isCurrentPlan = (plan: SubscriptionPlan) => {
    if (!subscriptionStatus) return false;

    // Only match by exact plan name - this ensures only ONE plan is current
    return subscriptionStatus.plan_name === plan.name;
  };

  const resolvePlanSliderMaxForPlan = (plan: SubscriptionPlan) => {
    const planCap = resolvePlanMaxMembers(plan);
    const subscribedSeats = isCurrentPlan(plan) ? subscriptionStatus?.member_count ?? 0 : 0;
    return resolvePlanSliderMax(planCap, subscribedSeats);
  };

  // Initialize memberCounts state properly for each plan
  useEffect(() => {
    if (!activePlans.length || !subscriptionStatus || Object.keys(memberCounts).length > 0) return;

    const newMemberCounts: { [key: string]: number } = {};

    activePlans.forEach(plan => {
      const isTrialPlan = plan.name === 'Trial' || plan.base_price_per_member === 0;
      const isCurrent = isCurrentPlan(plan);
      const maxEmployees = resolvePlanMaxMembers(plan);
      
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
  }, [activePlans, subscriptionStatus, currentMemberCount]);

  const handleMemberCountChange = (planId: string, count: number) => {
    const cap = Math.max(1, Math.round(Number(count)) || 1);
    setMemberCounts((prev) => ({ ...prev, [planId]: count }));
    setPlanAddOnUi((prev) => {
      const row = prev[planId];
      if (!row) return prev;
      let changed = false;
      const nextRow: Record<string, { included: boolean; quantity: number }> = { ...row };
      for (const [code, sel] of Object.entries(row)) {
        if (sel && sel.quantity > cap) {
          nextRow[code] = { ...sel, quantity: cap };
          changed = true;
        }
      }
      return changed ? { ...prev, [planId]: nextRow } : prev;
    });
  };

  const handleBillingCycleChange = (planId: string, isYearly: boolean) => {
    setBillingCycles(prev => ({ ...prev, [planId]: isYearly ? 'yearly' : 'monthly' }));
  };

  const mergeSelections = useCallback(
    (plan: SubscriptionPlan, isCurrent: boolean, hrMemberCount: number) =>
      mergePlanAddOnSelections(
        plan,
        planAddOnUi[plan.id],
        isCurrent,
        omnichannelPaidSeats,
        hrMemberCount,
      ),
    [planAddOnUi, omnichannelPaidSeats],
  );

  /** Merged add-on map for the open checkout (`selectedPlan`), preferring the card snapshot from click time. */
  const mergeCheckoutSelectionsForSelectedPlan = useCallback((): Record<
    string,
    { included: boolean; quantity: number }
  > => {
    if (!selectedPlan) return {};
    if (checkoutAddOnSnapshot?.planId === selectedPlan.id) return checkoutAddOnSnapshot.selections;
    return mergeSelections(selectedPlan, isCurrentPlan(selectedPlan), selectedMemberCount);
  }, [selectedPlan, selectedMemberCount, checkoutAddOnSnapshot, mergeSelections]);

  useEffect(() => {
    if (!selectedPlan) setCheckoutAddOnSnapshot(null);
  }, [selectedPlan]);

  /** Add-on portion that matches Midtrans gross (full list vs prorated incremental when HR prorate applies). */
  const catalogAddOnBillingChargeIdr = useMemo(() => {
    if (!selectedPlan) return 0;
    const cycle = isYearly ? "yearly" : "monthly";
    return catalogAddonChargeForMidtransSplit({
      plan: selectedPlan,
      billingCycle: cycle,
      annualDiscountPercent: selectedPlan.annual_discount_percentage,
      selections: mergeCheckoutSelectionsForSelectedPlan(),
      legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
      calculation: proRatedData?.calculation,
    });
  }, [
    selectedPlan,
    isYearly,
    omnichannelPaidSeats,
    mergeCheckoutSelectionsForSelectedPlan,
    proRatedData?.calculation,
  ]);

  /** Add-on line for confirmation modal (full yearly list when monthly→yearly same plan, else billing charge). */
  const catalogAddOnForConfirmationModalIdr = useMemo(() => {
    if (!selectedPlan || !subscriptionStatus) return 0;
    const billingUpOnly =
      currentPlanId === selectedPlan.id &&
      currentMemberCount === selectedMemberCount &&
      (subscriptionStatus.billing_cycle || "monthly") === "monthly" &&
      isYearly;
    if (billingUpOnly) {
      return catalogAddOnListAmountForMidtransSplit({
        plan: selectedPlan,
        billingCycle: "yearly",
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        selections: mergeCheckoutSelectionsForSelectedPlan(),
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
      });
    }
    return catalogAddOnBillingChargeIdr;
  }, [
    selectedPlan,
    subscriptionStatus,
    currentPlanId,
    currentMemberCount,
    isYearly,
    omnichannelPaidSeats,
    mergeCheckoutSelectionsForSelectedPlan,
    catalogAddOnBillingChargeIdr,
  ]);

  const handleAddOnIncludedChange = useCallback((planId: string, code: string, included: boolean) => {
    setPlanAddOnUi((prev) => {
      const cur = prev[planId]?.[code] ?? { included: false, quantity: 1 };
      return {
        ...prev,
        [planId]: { ...(prev[planId] ?? {}), [code]: { ...cur, included } },
      };
    });
  }, []);

  const handleAddOnQuantityChange = useCallback(
    (planId: string, code: string, quantity: number, hrMemberCap: number) => {
      const cap = Math.max(1, Math.round(Number(hrMemberCap)) || 1);
      const q = Math.min(cap, Math.max(1, Math.round(Number(quantity)) || 1));
      setPlanAddOnUi((prev) => {
        const cur = prev[planId]?.[code] ?? { included: false, quantity: 1 };
        return {
          ...prev,
          [planId]: { ...(prev[planId] ?? {}), [code]: { ...cur, quantity: q } },
        };
      });
    },
    [],
  );

  const calculatePlanPrice = (plan: SubscriptionPlan, memberCount: number, isYearly: boolean) => {
    const basePrice = plan.base_price_per_member * memberCount;
    if (isYearly && plan.annual_discount_percentage) {
      return basePrice * 12 * (1 - plan.annual_discount_percentage / 100);
    }
    return isYearly ? basePrice * 12 : basePrice;
  };

  const handleUpgrade = useCallback(
    async (
      plan: SubscriptionPlan,
      memberCount: number,
      billingCycleOverride?: "monthly" | "yearly",
      addOnAtClick?: Record<string, { included: boolean; quantity: number }>,
    ) => {
      const selectedBillingCycle = billingCycleOverride || billingCycles[plan.id] || "monthly";
      const mergedAtClick = addOnAtClick ?? mergeSelections(plan, isCurrentPlan(plan), memberCount);
      setCheckoutAddOnSnapshot({ planId: plan.id, selections: mergedAtClick });
      setSelectedPlan(plan);
      setSelectedMemberCount(memberCount);
      // Update global isYearly state for modal consistency
      setIsYearly(selectedBillingCycle === "yearly");

      setPlanCardPrimaryPendingId(plan.id);
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
    } finally {
      setPlanCardPrimaryPendingId(null);
    }
  }, [proRateCalculation, billingCycles, subscriptionStatus, currentPlanId, currentMemberCount, mergeSelections]);

  const schedulePlanChange = useSchedulePlanChange();
  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = async () => {
      await Promise.all([refetchPlans(), refreshSubscriptionStatus()]);
    };
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetchPlans, refreshSubscriptionStatus]);

  const handleRenew = useCallback(
    async (
      plan: SubscriptionPlan,
      memberCount: number,
      billingCycle: "monthly" | "yearly",
      addOnAtClick?: Record<string, { included: boolean; quantity: number }>,
    ) => {
      if (!subscriptionStatus) return;

      setPlanCardPrimaryPendingId(plan.id);
      try {
        const selections = addOnAtClick ?? mergeSelections(plan, isCurrentPlan(plan), memberCount);

        const chargeCycle = subscriptionStatus.billing_cycle === "yearly" ? "yearly" : billingCycle;
        const basePrice = plan.base_price_per_member;
        const finalAmount =
          chargeCycle === "yearly"
            ? getYearlyPriceForMembers(basePrice, memberCount, plan.annual_discount_percentage)
            : getMonthlyPriceForMembers(basePrice, memberCount);

        const catalogAddonRenew = catalogAddOnListAmountForMidtransSplit({
          plan,
          billingCycle: chargeCycle,
          annualDiscountPercent: plan.annual_discount_percentage,
          selections,
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        });
        const grossRenew = finalAmount + catalogAddonRenew;
        const itemDetails = buildMidtransExplicitHrAndAddonItemDetails({
          hrChargeAmountIdr: finalAmount,
          catalogAddOnsListAmountIdr: catalogAddonRenew,
          billingCycle: chargeCycle,
          planName: plan.name,
          memberCount,
        });

        await initiateMidtransPayment({
          planId: plan.id,
          planName: plan.name,
          amount: grossRenew,
          memberCount,
          billingCycle: chargeCycle,
          proRateDetails: {
            is_member_upgrade: false,
            previous_member_count: memberCount,
            member_difference: 0,
            remaining_days: 0,
            prorate_amount: 0,
            prorate_percentage: 0,
            bundled_omnichannel_roster_units: bundledOmnichannelRosterUnitsFromSelections(selections),
          },
          ...(itemDetails ? { itemDetails } : {}),
        });
      } catch {
        toast.error(t("subscription.plans.error.renewalFailed"));
      } finally {
        setPlanCardPrimaryPendingId(null);
      }
  }, [subscriptionStatus, initiateMidtransPayment, t, omnichannelPaidSeats, mergeSelections]);

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
        const catalogAddonYearly = catalogAddOnListAmountForMidtransSplit({
          plan: selectedPlan,
          billingCycle: "yearly",
          annualDiscountPercent: selectedPlan.annual_discount_percentage,
          selections: mergeCheckoutSelectionsForSelectedPlan(),
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        });
        const grossYearly = fullYearlyPrice + catalogAddonYearly;
        const itemDetailsYearly = buildMidtransExplicitHrAndAddonItemDetails({
          hrChargeAmountIdr: fullYearlyPrice,
          catalogAddOnsListAmountIdr: catalogAddonYearly,
          billingCycle: "yearly",
          planName: selectedPlan.name,
          memberCount: selectedMemberCount,
        });
        await initiateMidtransPayment({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: grossYearly,
          memberCount: selectedMemberCount,
          billingCycle: 'yearly',
          proRateDetails: {
            is_member_upgrade: false,
            previous_member_count: selectedMemberCount,
            member_difference: 0,
            remaining_days: 0,
            prorate_amount: 0,
            prorate_percentage: 0,
            bundled_omnichannel_roster_units: bundledOmnichannelRosterUnitsFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
          },
          ...(itemDetailsYearly ? { itemDetails: itemDetailsYearly } : {}),
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

      const catalogAddonMain = catalogAddonChargeForMidtransSplit({
        plan: selectedPlan,
        billingCycle: isYearly ? "yearly" : "monthly",
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        selections: mergeCheckoutSelectionsForSelectedPlan(),
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        calculation: proRatedData?.calculation,
      });
      const grossMain = finalAmount + catalogAddonMain;
      const itemDetailsMain = buildMidtransExplicitHrAndAddonItemDetails({
        hrChargeAmountIdr: finalAmount,
        catalogAddOnsListAmountIdr: catalogAddonMain,
        billingCycle: isYearly ? "yearly" : "monthly",
        planName: selectedPlan.name,
        memberCount: selectedMemberCount,
      });

      const bundledUnitsPay = bundledOmnichannelRosterUnitsFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: grossMain,
        memberCount: selectedMemberCount,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        ...(itemDetailsMain ? { itemDetails: itemDetailsMain } : {}),
        proRateDetails: proRatedData?.calculation
          ? {
              is_member_upgrade: Boolean(
                proRatedData.calculation.is_upgrade && !proRatedData.calculation.is_plan_change,
              ),
              previous_member_count: proRatedData.current_plan.member_count,
              member_difference: proRatedData.calculation.member_difference ?? 0,
              remaining_days: proRatedData.calculation.remaining_days,
              prorate_amount: proRatedData.calculation.prorate_amount,
              prorate_percentage: proRatedData.calculation.prorate_percentage ?? 0,
              bundled_omnichannel_roster_units: bundledUnitsPay,
            }
          : {
              is_member_upgrade: false,
              previous_member_count: selectedMemberCount,
              member_difference: 0,
              remaining_days: 0,
              prorate_amount: 0,
              prorate_percentage: 0,
              bundled_omnichannel_roster_units: bundledUnitsPay,
            },
      });
      
      setIsModalOpen(false);
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment/schedule
    }
  }, [selectedPlan, selectedMemberCount, isYearly, initiateMidtransPayment, proRatedData, schedulePlanChange, subscriptionStatus, currentPlanId, currentMemberCount, omnichannelPaidSeats, mergeCheckoutSelectionsForSelectedPlan]);

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

      const catalogAddonImmediate = catalogAddonChargeForMidtransSplit({
        plan: selectedPlan,
        billingCycle: isYearly ? "yearly" : "monthly",
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        selections: mergeCheckoutSelectionsForSelectedPlan(),
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        calculation: proRatedData?.calculation,
      });
      const grossImmediate = finalAmount + catalogAddonImmediate;
      const itemDetailsImmediate = buildMidtransExplicitHrAndAddonItemDetails({
        hrChargeAmountIdr: finalAmount,
        catalogAddOnsListAmountIdr: catalogAddonImmediate,
        billingCycle: isYearly ? "yearly" : "monthly",
        planName: selectedPlan.name,
        memberCount: selectedMemberCount,
      });

      const bundledUnitsImmediate = bundledOmnichannelRosterUnitsFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: grossImmediate,
        memberCount: selectedMemberCount,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        ...(itemDetailsImmediate ? { itemDetails: itemDetailsImmediate } : {}),
        proRateDetails: proRatedData?.calculation
          ? {
              is_member_upgrade: Boolean(
                proRatedData.calculation.is_upgrade && !proRatedData.calculation.is_plan_change,
              ),
              previous_member_count: proRatedData.current_plan.member_count,
              member_difference: proRatedData.calculation.member_difference ?? 0,
              remaining_days: proRatedData.calculation.remaining_days,
              prorate_amount: proRatedData.calculation.prorate_amount,
              prorate_percentage: proRatedData.calculation.prorate_percentage ?? 0,
              bundled_omnichannel_roster_units: bundledUnitsImmediate,
            }
          : {
              is_member_upgrade: false,
              previous_member_count: selectedMemberCount,
              member_difference: 0,
              remaining_days: 0,
              prorate_amount: 0,
              prorate_percentage: 0,
              bundled_omnichannel_roster_units: bundledUnitsImmediate,
            },
      });
      
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment
    }
  }, [selectedPlan, selectedMemberCount, isYearly, initiateMidtransPayment, proRatedData, omnichannelPaidSeats, mergeCheckoutSelectionsForSelectedPlan]);

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
    if (rosterCount > newMemberCount) return false;

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

  return {
    t,
    plans,
    plansError,
    refetchPlans,
    subscriptionStatus,
    subscriptionPlans,
    organizationId,
    activePlans,
    showOmnichannelAddonInsideScaleUpCard,
    globalOmnichannelUnitPrice,
    lastPaidAmount,
    lastPaidMemberCount,
    omnichannelPaidSeats,
    rosterCount,
    memberCounts,
    billingCycles,
    isYearly,
    selectedPlan,
    setSelectedPlan,
    selectedMemberCount,
    isModalOpen,
    setIsModalOpen,
    isOptionsModalOpen,
    setIsOptionsModalOpen,
    proRatedData,
    setProRatedData,
    planAddOnUi,
    checkoutAddOnSnapshot,
    planCardPrimaryPendingId,
    currentPlanId,
    currentMemberCount,
    currentEmployeeCount,
    isMidtransConfirmLoading,
    proRateCalculation,
    catalogAddOnBillingChargeIdr,
    catalogAddOnForConfirmationModalIdr,
    isRenewEligibleBase,
    daysUntilExpiry,
    isRenewWindow,
    resolvePlanMaxMembers,
    resolvePlanSliderMaxForPlan,
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
  };
}
