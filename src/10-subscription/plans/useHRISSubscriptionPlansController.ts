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
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import {
  getMonthlyPriceForMembers,
  getYearlyPriceForMembers,
  formatIDR,
  buildMidtransExplicitHrAndAddonItemDetails,
  buildCurrentAddonSnapshot,
  buildTargetAddonSelectionsForSchedule,
  catalogAddonChargeForMidtransSplit,
  catalogAddOnListAmountForMidtransSplit,
  bundledOmnichannelRosterUnitsFromSelections,
  bundledLeadMagnetFromSelections,
  bundledPosOutletUnitsFromSelections,
  bundledPosAddonFromSelections,
  hasPosAddonEnableDelta,
  getOmnichannelAddonMonthlyTotalIdr,
  getOmnichannelRosterAddonConfig,
  isScaleUpSubscriptionPlanName,
  isEnterpriseSubscriptionPlan,
  resolveEnterpriseSliderMin,
  sortSubscriptionPlansForDisplay,
  shouldShowAddOnsSidebar,
  relocateAddOnDetailToPanel,
  mergePlanAddOnSelections,
  mergePlanAddOnSelectionsForCheckout,
  planEligibleForOmnichannelAddonDisplay,
  addOnLineQuantityCap,
  OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY,
  POS_OUTLETS_ADD_ON_CODE,
  hasCheckoutableCatalogAddOnDelta,
  hasSchedulableDowngrade,
  isAddOnOnlyMidCycleCheckout,
  isAddonSelectionDowngrade,
  isMidCycleActiveSubscription,
  isTargetPlanDowngrade,
  resolveCheckoutRemainingDays,
} from "@/10-subscription/shared/subscriptionUtils";
import { supabase } from "@/shared/lib/supabaseClient";
import { type ProRatedData } from "@/10-subscription/plans/modals/UpgradeConfirmationModal";
import { useSchedulePlanChange, type SchedulePlanChangeParams } from "@/10-subscription/hooks/useSchedulePlanChange";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { invalidatePlanModuleAccessForOrg } from "@/10-subscription/shared/invalidatePlanModuleAccess";
import {
  defaultPaidPlanMemberCount,
  getPlanMaxMembers,
  planUsesPerMemberPricing,
  resolveFreePlanMaxMembers,
  resolvePaidPlanMemberFloor,
  resolvePlanSliderMax,
  resolvePaidPlanSliderMin,
} from "@/0-onboarding/utils/subscriptionPlanUtils";
import {
  organizationOmnichannelStaffQueryKey,
  useOrganizationOmnichannelStaff,
} from "@/shared/hooks/useOrganizationOmnichannelStaff";
import {
  billingCycleFromTerm,
  billingTermMonthsFromLegacyCycle,
  coerceBillingTermMonths,
  computePlanTermPriceIdr,
  defaultBillingTermForPlan,
  resolvePlanBillingSelection,
  usesBillingTermSelector,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";

export const RENEWAL_WINDOW_DAYS = 7;

export type PlanChangeType =
  | "upgrade"
  | "downgrade"
  | "member_increase"
  | "member_decrease"
  | "mixed"
  | "addon_decrease"
  | "addon_disable";

function toPlanChangeType(value: unknown, fallback: PlanChangeType): PlanChangeType {
  const allowed: PlanChangeType[] = [
    "upgrade",
    "downgrade",
    "member_increase",
    "member_decrease",
    "mixed",
    "addon_decrease",
    "addon_disable",
  ];
  return typeof value === "string" && allowed.includes(value as PlanChangeType)
    ? (value as PlanChangeType)
    : fallback;
}

function resolveScheduledDate(
  subscriptionStatus: { subscription_end_date?: string } | null | undefined,
  fromCalculation?: string | null,
): string {
  if (fromCalculation && String(fromCalculation).trim()) return String(fromCalculation).trim();
  if (subscriptionStatus?.subscription_end_date) return subscriptionStatus.subscription_end_date;
  return new Date().toISOString();
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
  const [billingTerms, setBillingTerms] = useState<Record<string, BillingTermMonths>>({});
  const [isYearly, setIsYearly] = useState(false);
  const [selectedBillingTermMonths, setSelectedBillingTermMonths] = useState<BillingTermMonths>(1);
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
  const { rows: posOutlets = [] } = usePosOutlets();
  const activeOutletCount = posOutlets.length;
  const omnichannelPaidSeats = subscriptionStatus?.omnichannel_paid_seat_count ?? 0;
  const leadMagnetActive = subscriptionStatus?.lead_magnet_active ?? false;
  const posPaidOutletCount = subscriptionStatus?.pos_paid_outlet_count ?? 0;
  const posAddonActive = subscriptionStatus?.pos_addon_active ?? false;
  /** All rows returned for `is_active = true` (no extra client-side hiding). */
  const activePlans = useMemo(
    () => sortSubscriptionPlansForDisplay(plans ?? []),
    [plans],
  );
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

  const enterpriseSliderMin = useMemo(
    () => resolveEnterpriseSliderMin(activePlans),
    [activePlans],
  );

  const resolvePlanSliderMinForPlan = (plan: SubscriptionPlan) => {
    if (isEnterpriseSubscriptionPlan(plan)) {
      return enterpriseSliderMin;
    }
    if (plan.name === "Trial" || plan.base_price_per_member === 0) {
      return 1;
    }
    return resolvePaidPlanSliderMin({
      paidMemberFloor,
      isCurrentPlan: isCurrentPlan(plan),
      isMidCycleActive,
      subscribedMemberCount: subscriptionStatus?.member_count ?? 0,
    });
  };

  const resolvePlanSliderMaxForPlan = (plan: SubscriptionPlan) => {
    const planCap = resolvePlanMaxMembers(plan);
    const subscribedSeats = isCurrentPlan(plan) ? subscriptionStatus?.member_count ?? 0 : 0;
    return resolvePlanSliderMax(planCap, subscribedSeats);
  };

  const paidMemberFloor = useMemo(
    () => resolvePaidPlanMemberFloor(resolveFreePlanMaxMembers(activePlans)),
    [activePlans],
  );

  const currentOrgBillingTermMonths = useMemo(
    () =>
      coerceBillingTermMonths(
        subscriptionStatus?.billing_term_months ??
          billingTermMonthsFromLegacyCycle(subscriptionStatus?.billing_cycle),
      ),
    [subscriptionStatus?.billing_term_months, subscriptionStatus?.billing_cycle],
  );

  // Initialize memberCounts state properly for each plan
  useEffect(() => {
    if (!activePlans.length || !subscriptionStatus || Object.keys(memberCounts).length > 0) return;

    const newMemberCounts: { [key: string]: number } = {};

    activePlans.forEach(plan => {
      const isEnterprise = isEnterpriseSubscriptionPlan(plan);
      const isTrialPlan =
        !isEnterprise && (plan.name === 'Trial' || plan.base_price_per_member === 0);
      const isCurrent = isCurrentPlan(plan);
      const maxEmployees = resolvePlanMaxMembers(plan);
      
      let defaultCount;
      if (isEnterprise) {
        defaultCount = isCurrent
          ? Math.max(
              enterpriseSliderMin,
              subscriptionStatus.member_count || currentMemberCount || enterpriseSliderMin,
            )
          : enterpriseSliderMin;
      } else if (isCurrent) {
        defaultCount = subscriptionStatus.member_count || currentMemberCount || 1;
        if (planUsesPerMemberPricing(plan)) {
          defaultCount = Math.max(defaultCount, paidMemberFloor);
        }
      } else if (isTrialPlan) {
        defaultCount = maxEmployees;
      } else {
        defaultCount = defaultPaidPlanMemberCount(paidMemberFloor, maxEmployees);
      }
      
      newMemberCounts[plan.id] = defaultCount;
    });

    setMemberCounts(newMemberCounts);
    // Intentionally omit memberCounts / isCurrentPlan: one-time init when plans load; re-run would reset sliders.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [activePlans, subscriptionStatus, currentMemberCount, paidMemberFloor, enterpriseSliderMin]);

  useEffect(() => {
    if (!activePlans.length || !subscriptionStatus || Object.keys(billingTerms).length > 0) return;

    const newBillingTerms: Record<string, BillingTermMonths> = {};
    const newBillingCycles: Record<string, "monthly" | "yearly"> = {};

    activePlans.forEach((plan) => {
      const isCurrent = isCurrentPlan(plan);
      if (usesBillingTermSelector(plan)) {
        const term = defaultBillingTermForPlan(
          plan,
          isCurrent ? currentOrgBillingTermMonths : undefined,
        );
        newBillingTerms[plan.id] = term;
        newBillingCycles[plan.id] = billingCycleFromTerm(term);
      } else {
        const cycle =
          isCurrent && subscriptionStatus.billing_cycle === "yearly" ? "yearly" : "monthly";
        newBillingCycles[plan.id] = cycle;
      }
    });

    setBillingTerms(newBillingTerms);
    setBillingCycles((prev) => ({ ...newBillingCycles, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init
  }, [activePlans, subscriptionStatus, currentOrgBillingTermMonths]);

  const handleMemberCountChange = (planId: string, count: number) => {
    const plan = activePlans.find((p) => p.id === planId);
    let cap = Math.max(1, Math.round(Number(count)) || 1);
    if (plan && isEnterpriseSubscriptionPlan(plan)) {
      const max = resolvePlanSliderMaxForPlan(plan);
      cap = Math.max(enterpriseSliderMin, Math.min(max, cap));
    } else if (plan && planUsesPerMemberPricing(plan)) {
      const max = resolvePlanSliderMaxForPlan(plan);
      const min = resolvePlanSliderMinForPlan(plan);
      cap = Math.max(min, Math.min(max, Math.max(cap, paidMemberFloor)));
    }
    setMemberCounts((prev) => ({ ...prev, [planId]: cap }));
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

  const handleBillingCycleChange = (planId: string, isYearlyToggle: boolean) => {
    setBillingCycles((prev) => ({ ...prev, [planId]: isYearlyToggle ? "yearly" : "monthly" }));
  };

  const handleBillingTermChange = (planId: string, months: BillingTermMonths) => {
    setBillingTerms((prev) => ({ ...prev, [planId]: months }));
    setBillingCycles((prev) => ({ ...prev, [planId]: billingCycleFromTerm(months) }));
  };

  const resolveBillingForPlan = useCallback(
    (plan: SubscriptionPlan) =>
      resolvePlanBillingSelection(
        plan,
        billingCycles,
        billingTerms,
        currentOrgBillingTermMonths,
      ),
    [billingCycles, billingTerms, currentOrgBillingTermMonths],
  );

  const mergeSelections = useCallback(
    (plan: SubscriptionPlan, isCurrent: boolean, hrMemberCount: number) =>
      mergePlanAddOnSelections(
        plan,
        planAddOnUi[plan.id],
        isCurrent,
        omnichannelPaidSeats,
        hrMemberCount,
        leadMagnetActive,
        posPaidOutletCount,
        posAddonActive,
      ),
    [planAddOnUi, omnichannelPaidSeats, leadMagnetActive, posPaidOutletCount, posAddonActive],
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
    const { billingCycle, billingTermMonths } = resolveBillingForPlan(selectedPlan);
    return catalogAddonChargeForMidtransSplit({
      plan: selectedPlan,
      billingCycle,
      annualDiscountPercent: selectedPlan.annual_discount_percentage,
      billingTermMonths,
      selections: mergeCheckoutSelectionsForSelectedPlan(),
      legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
      legacyLeadMagnetActive: leadMagnetActive,
      legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
      calculation: proRatedData?.calculation,
    });
  }, [
    selectedPlan,
    resolveBillingForPlan,
    omnichannelPaidSeats,
    mergeCheckoutSelectionsForSelectedPlan,
    proRatedData?.calculation,
    leadMagnetActive,
    posPaidOutletCount,
  ]);

  /** Add-on line for confirmation modal (full term list when billing-term upgrade only, else billing charge). */
  const catalogAddOnForConfirmationModalIdr = useMemo(() => {
    if (!selectedPlan || !subscriptionStatus) return 0;
    const { billingCycle, billingTermMonths } = resolveBillingForPlan(selectedPlan);
    const billingUpOnly =
      currentPlanId === selectedPlan.id &&
      currentMemberCount === selectedMemberCount &&
      billingTermMonths > currentOrgBillingTermMonths;
    if (billingUpOnly) {
      return catalogAddOnListAmountForMidtransSplit({
        plan: selectedPlan,
        billingCycle,
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        billingTermMonths,
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
    selectedMemberCount,
    currentOrgBillingTermMonths,
    resolveBillingForPlan,
    omnichannelPaidSeats,
    mergeCheckoutSelectionsForSelectedPlan,
    catalogAddOnBillingChargeIdr,
  ]);

  const handleAddOnIncludedChange = useCallback((planId: string, code: string, included: boolean) => {
    setPlanAddOnUi((prev) => {
      const defaultQty = code === POS_OUTLETS_ADD_ON_CODE ? 0 : 1;
      const cur = prev[planId]?.[code] ?? { included: false, quantity: defaultQty };
      return {
        ...prev,
        [planId]: { ...(prev[planId] ?? {}), [code]: { ...cur, included } },
      };
    });
  }, []);

  const handleAddOnQuantityChange = useCallback(
    (planId: string, code: string, quantity: number, hrMemberCap: number) => {
      const cap = addOnLineQuantityCap(code, hrMemberCap);
      const minQ = code === POS_OUTLETS_ADD_ON_CODE ? 0 : 1;
      const q = Math.min(cap, Math.max(minQ, Math.round(Number(quantity)) || minQ));
      setPlanAddOnUi((prev) => {
        const cur = prev[planId]?.[code] ?? { included: false, quantity: minQ };
        return {
          ...prev,
          [planId]: { ...(prev[planId] ?? {}), [code]: { ...cur, quantity: q } },
        };
      });
    },
    [],
  );

  const calculatePlanPrice = (
    plan: SubscriptionPlan,
    memberCount: number,
    isYearlyPlan: boolean,
    billingTermMonths?: BillingTermMonths,
  ) => {
    if (usesBillingTermSelector(plan)) {
      const months = billingTermMonths ?? (isYearlyPlan ? 12 : 1);
      return computePlanTermPriceIdr(plan, memberCount, months);
    }
    const basePrice = plan.base_price_per_member * memberCount;
    if (isYearlyPlan && plan.annual_discount_percentage) {
      return basePrice * 12 * (1 - plan.annual_discount_percentage / 100);
    }
    return isYearlyPlan ? basePrice * 12 : basePrice;
  };

  const handleUpgrade = useCallback(
    async (
      plan: SubscriptionPlan,
      memberCount: number,
      billingCycleOverride?: "monthly" | "yearly",
      addOnAtClick?: Record<string, { included: boolean; quantity: number }>,
    ) => {
      if (isEnterpriseSubscriptionPlan(plan)) return;

      const selectedBillingCycle = billingCycleOverride || billingCycles[plan.id] || "monthly";
      const { billingTermMonths } = resolvePlanBillingSelection(
        plan,
        billingCycles,
        billingTerms,
        currentOrgBillingTermMonths,
      );
      const mergedAtClick = addOnAtClick ?? mergeSelections(plan, isCurrentPlan(plan), memberCount);
      setCheckoutAddOnSnapshot({ planId: plan.id, selections: mergedAtClick });
      setSelectedPlan(plan);
      setSelectedMemberCount(memberCount);
      setSelectedBillingTermMonths(billingTermMonths);
      setIsYearly(selectedBillingCycle === "yearly");

      setPlanCardPrimaryPendingId(plan.id);
      try {
      if (planUsesPerMemberPricing(plan) && memberCount < paidMemberFloor) {
        toast.error(t("subscription.plans.error.paidMemberFloor", { min: paidMemberFloor }));
        return;
      }

      const midCycleActive = isMidCycleActiveSubscription(subscriptionStatus);
      const currentBillingCycle = subscriptionStatus?.billing_cycle || "monthly";
      const isCurrent = isCurrentPlan(plan);
      const activePlanRow = subscriptionPlans?.find((p) => p.name === subscriptionStatus?.plan_name);
      const isPlanDowngradeTarget =
        Boolean(activePlanRow && !isCurrent && isTargetPlanDowngrade(activePlanRow, plan));

      const schedDowngradePrecheck = hasSchedulableDowngrade({
        isCurrentPlan: isCurrent,
        memberCount,
        currentMemberCount,
        billingCycle: selectedBillingCycle,
        currentBillingCycle,
        plan,
        selections: mergedAtClick,
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        legacyLeadMagnetActive: leadMagnetActive,
        legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
        isTargetPlanDowngrade: isPlanDowngradeTarget,
        currentEmployeeCount,
        rosterCount,
        isExpired: subscriptionStatus?.is_expired,
        isRenewWindow:
          isCurrent &&
          Boolean(subscriptionStatus) &&
          (subscriptionStatus?.is_expired ||
            (!subscriptionStatus?.is_trial &&
              typeof subscriptionStatus?.days_until_expiry === "number" &&
              subscriptionStatus.days_until_expiry >= 0 &&
              subscriptionStatus.days_until_expiry <= RENEWAL_WINDOW_DAYS)),
      });

      if (schedDowngradePrecheck && memberCount < currentMemberCount && currentEmployeeCount > memberCount) {
        toast.error(t("subscription.plans.downgrade.error", { count: currentEmployeeCount }));
        return;
      }
      if (
        schedDowngradePrecheck &&
        isAddonSelectionDowngrade(plan, mergedAtClick, {
          omnichannelPaidSeats,
          leadMagnetActive,
          posPaidOutletCount,
          posAddonActive,
        }) &&
        rosterCount > bundledOmnichannelRosterUnitsFromSelections(mergedAtClick)
      ) {
        toast.error(
          t("subscription.plans.downgrade.rosterExceedsMembers", {
            roster: rosterCount,
            members: bundledOmnichannelRosterUnitsFromSelections(mergedAtClick),
          }),
        );
        return;
      }
      if (
        schedDowngradePrecheck &&
        isAddonSelectionDowngrade(plan, mergedAtClick, {
          omnichannelPaidSeats,
          leadMagnetActive,
          posPaidOutletCount,
          posAddonActive,
        }) &&
        activeOutletCount > 1 + bundledPosOutletUnitsFromSelections(mergedAtClick)
      ) {
        toast.error(
          t("subscription.plans.downgrade.outletsExceedQuota", {
            outlets: activeOutletCount,
            quota: 1 + bundledPosOutletUnitsFromSelections(mergedAtClick),
          }),
        );
        return;
      }

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

        // ✅ Billing term upgrade only: same plan, same members, longer term.
        const isBillingTermUpgradeOnly =
          currentPlanId === plan.id &&
          currentMemberCount === memberCount &&
          billingTermMonths > currentOrgBillingTermMonths;
        if (isBillingTermUpgradeOnly && calculation.calculation) {
          calculation.calculation.charge_now = true;
        }

        // ✅ Add-on-only mid-cycle: same plan/members/billing with incremental add-ons to purchase.
        const effectiveRemainingDays = resolveCheckoutRemainingDays({
          subscriptionStatus,
          prorateRemainingDays: calculation.calculation?.remaining_days,
        });
        const isAddOnOnlyCheckout =
          calculation.calculation &&
          isAddOnOnlyMidCycleCheckout({
            isCurrentPlan: isCurrentPlan(plan),
            memberCount,
            currentMemberCount,
            billingCycle: selectedBillingCycle,
            currentBillingCycle: subscriptionStatus?.billing_cycle || "monthly",
            plan,
            annualDiscountPercent: plan.annual_discount_percentage,
            selections: mergedAtClick,
            legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
            legacyLeadMagnetActive: leadMagnetActive,
            legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
            isExpired: subscriptionStatus?.is_expired,
            remainingDays: effectiveRemainingDays,
          });
        if (isAddOnOnlyCheckout && calculation.calculation) {
          calculation.calculation.remaining_days = effectiveRemainingDays;
          calculation.calculation.charge_now = true;
          calculation.calculation.prorate_amount = 0;
          (calculation.calculation as { addon_only_checkout?: boolean }).addon_only_checkout = true;
        }

        const schedDowngrade =
          !isExpired &&
          schedDowngradePrecheck &&
          !isAddOnOnlyCheckout &&
          calculation.calculation &&
          (midCycleActive || !calculation.calculation.charge_now);

        if (schedDowngrade && calculation.calculation) {
          calculation.calculation.charge_now = false;
          calculation.calculation.prorate_amount = 0;
          calculation.calculation.scheduled_date = resolveScheduledDate(
            subscriptionStatus,
            calculation.calculation.scheduled_date,
          );
          (calculation.calculation as { schedule_only_downgrade?: boolean }).schedule_only_downgrade = true;
        }

        setProRatedData(calculation as ProRatedData);

        if (isAddOnOnlyCheckout) {
          setIsModalOpen(true);
          return;
        }

        if (schedDowngrade) {
          setIsModalOpen(true);
          return;
        }

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
  }, [proRateCalculation, billingCycles, billingTerms, currentOrgBillingTermMonths, subscriptionStatus, subscriptionPlans, currentPlanId, currentMemberCount, mergeSelections, omnichannelPaidSeats, leadMagnetActive, isCurrentPlan, paidMemberFloor, currentEmployeeCount, rosterCount, t]);

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
      if (!subscriptionStatus || isEnterpriseSubscriptionPlan(plan)) return;

      setPlanCardPrimaryPendingId(plan.id);
      try {
        const selections =
          addOnAtClick ??
          mergePlanAddOnSelectionsForCheckout(plan, planAddOnUi[plan.id], memberCount);

        const { billingCycle: chargeCycle, billingTermMonths } = resolvePlanBillingSelection(
          plan,
          billingCycles,
          billingTerms,
          currentOrgBillingTermMonths,
        );
        const basePrice = plan.base_price_per_member;
        const finalAmount = usesBillingTermSelector(plan)
          ? computePlanTermPriceIdr(plan, memberCount, billingTermMonths)
          : chargeCycle === "yearly"
            ? getYearlyPriceForMembers(basePrice, memberCount, plan.annual_discount_percentage)
            : getMonthlyPriceForMembers(basePrice, memberCount);

        const catalogAddonRenew = catalogAddOnListAmountForMidtransSplit({
          plan,
          billingCycle: chargeCycle,
          annualDiscountPercent: plan.annual_discount_percentage,
          billingTermMonths,
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
          billingTermMonths,
          proRateDetails: {
            is_member_upgrade: false,
            previous_member_count: memberCount,
            member_difference: 0,
            remaining_days: 0,
            prorate_amount: 0,
            prorate_percentage: 0,
            bundled_omnichannel_roster_units: bundledOmnichannelRosterUnitsFromSelections(selections),
            bundled_lead_magnet_included: bundledLeadMagnetFromSelections(selections),
            bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(selections),
            bundled_pos_addon_included: bundledPosAddonFromSelections(selections),
            renewal_full_period: true,
          },
          ...(itemDetails ? { itemDetails } : {}),
        });
      } catch {
        toast.error(t("subscription.plans.error.renewalFailed"));
      } finally {
        setPlanCardPrimaryPendingId(null);
      }
  }, [subscriptionStatus, initiateMidtransPayment, t, omnichannelPaidSeats, planAddOnUi, billingCycles, billingTerms, currentOrgBillingTermMonths]);

  const handleConfirmUpgrade = useCallback(async () => {
    if (!selectedPlan || isEnterpriseSubscriptionPlan(selectedPlan)) return;

    if (planUsesPerMemberPricing(selectedPlan) && selectedMemberCount < paidMemberFloor) {
      toast.error(t("subscription.plans.error.paidMemberFloor", { min: paidMemberFloor }));
      return;
    }

    const { billingCycle: selectedBillingCycle, billingTermMonths } = resolveBillingForPlan(selectedPlan);

    try {
      const isBillingTermUpgradeOnly =
        currentPlanId === selectedPlan.id &&
        currentMemberCount === selectedMemberCount &&
        billingTermMonths > currentOrgBillingTermMonths;
      if (isBillingTermUpgradeOnly) {
        const fullTermPrice = computePlanTermPriceIdr(
          selectedPlan,
          selectedMemberCount,
          billingTermMonths,
        );
        const catalogAddonTerm = catalogAddOnListAmountForMidtransSplit({
          plan: selectedPlan,
          billingCycle: selectedBillingCycle,
          annualDiscountPercent: selectedPlan.annual_discount_percentage,
          billingTermMonths,
          selections: mergeCheckoutSelectionsForSelectedPlan(),
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        });
        const grossTerm = fullTermPrice + catalogAddonTerm;
        const itemDetailsTerm = buildMidtransExplicitHrAndAddonItemDetails({
          hrChargeAmountIdr: fullTermPrice,
          catalogAddOnsListAmountIdr: catalogAddonTerm,
          billingCycle: selectedBillingCycle,
          planName: selectedPlan.name,
          memberCount: selectedMemberCount,
        });
        await initiateMidtransPayment({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: grossTerm,
          memberCount: selectedMemberCount,
          billingCycle: selectedBillingCycle,
          billingTermMonths,
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
            bundled_lead_magnet_included: bundledLeadMagnetFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
            bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
            bundled_pos_addon_included: bundledPosAddonFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
          },
          ...(itemDetailsTerm ? { itemDetails: itemDetailsTerm } : {}),
        });
        setIsModalOpen(false);
        setSelectedPlan(null);
        setProRatedData(null);
        return;
      }

      // ✅ Add-on-only mid-cycle: charge prorated incremental add-ons only (HR = 0).
      const isAddOnOnlyCheckout = Boolean(
        (proRatedData?.calculation as { addon_only_checkout?: boolean } | undefined)?.addon_only_checkout,
      );
      if (isAddOnOnlyCheckout && proRatedData?.calculation) {
        const catalogAddonOnly = catalogAddonChargeForMidtransSplit({
          plan: selectedPlan,
          billingCycle: selectedBillingCycle,
          annualDiscountPercent: selectedPlan.annual_discount_percentage,
          billingTermMonths,
          selections: mergeCheckoutSelectionsForSelectedPlan(),
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
          legacyLeadMagnetActive: leadMagnetActive,
          legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
          calculation: proRatedData.calculation,
        });
        if (catalogAddonOnly <= 0) {
          const zeroSels = mergeCheckoutSelectionsForSelectedPlan();
          if (
            organizationId &&
            hasPosAddonEnableDelta(zeroSels, posAddonActive)
          ) {
            const { error: enableErr } = await supabase.rpc("enable_pos_addon_zero_charge", {
              p_org_id: organizationId,
              p_paid_outlet_count: bundledPosOutletUnitsFromSelections(zeroSels),
            });
            if (enableErr) {
              toast.error(enableErr.message || t("subscription.plans.error.upgradeFailed"));
            } else {
              await refreshSubscriptionStatus();
              toast.success(t("subscription.plans.posAddonEnabledToast", "POS add-on enabled."));
            }
          }
          setIsModalOpen(false);
          setSelectedPlan(null);
          setProRatedData(null);
          return;
        }
        const itemDetailsAddonOnly = buildMidtransExplicitHrAndAddonItemDetails({
          hrChargeAmountIdr: 0,
          catalogAddOnsListAmountIdr: catalogAddonOnly,
          billingCycle: selectedBillingCycle,
          planName: selectedPlan.name,
          memberCount: selectedMemberCount,
        });
        const bundledUnitsAddonOnly = bundledOmnichannelRosterUnitsFromSelections(
          mergeCheckoutSelectionsForSelectedPlan(),
        );
        const bundledLeadMagnetAddonOnly = bundledLeadMagnetFromSelections(
          mergeCheckoutSelectionsForSelectedPlan(),
        );
        await initiateMidtransPayment({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: catalogAddonOnly,
          memberCount: selectedMemberCount,
          billingCycle: selectedBillingCycle,
          billingTermMonths,
          ...(itemDetailsAddonOnly ? { itemDetails: itemDetailsAddonOnly } : {}),
          proRateDetails: {
            is_member_upgrade: false,
            previous_member_count: selectedMemberCount,
            member_difference: 0,
            remaining_days: proRatedData.calculation.remaining_days,
            prorate_amount: 0,
            prorate_percentage: 0,
            bundled_omnichannel_roster_units: bundledUnitsAddonOnly,
            bundled_lead_magnet_included: bundledLeadMagnetAddonOnly,
            bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
            bundled_pos_addon_included: bundledPosAddonFromSelections(
              mergeCheckoutSelectionsForSelectedPlan(),
            ),
          },
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
        const checkoutSelections = mergeCheckoutSelectionsForSelectedPlan();
        const schedulePayload: SchedulePlanChangeParams = {
          current_plan_id: proRatedData.current_plan.id ?? currentPlanId ?? "",
          target_plan_id: proRatedData.target_plan.id ?? selectedPlan.id,
          current_member_count: proRatedData.current_plan.member_count,
          target_member_count: proRatedData.calculation.new_member_count,
          change_type: toPlanChangeType(proRatedData.calculation.change_type, "downgrade"),
          scheduled_date: resolveScheduledDate(
            subscriptionStatus,
            proRatedData.calculation.scheduled_date,
          ),
          prorate_amount: 0,
          charge_now: false,
          target_billing_cycle: selectedBillingCycle,
          target_billing_term_months: billingTermMonths,
          target_addon_selections: buildTargetAddonSelectionsForSchedule(selectedPlan, checkoutSelections),
          current_addon_snapshot: buildCurrentAddonSnapshot({
            omnichannelPaidSeats,
            leadMagnetActive,
            posPaidOutletCount,
            posAddonActive,
          }),
        };

        await schedulePlanChange.mutateAsync(schedulePayload);

        setIsModalOpen(false);
        setSelectedPlan(null);
        setProRatedData(null);
        if (organizationId) {
          queryClient.invalidateQueries({ queryKey: ["subscription-change-requests", organizationId] });
        }
        return;
      }

      // Otherwise, proceed with immediate payment (upgrade/member increase OR expired subscription)
      const basePrice = selectedPlan.base_price_per_member;
      // Use prorate_amount if it exists and > 0, otherwise use full price
      const prorateAmount = proRatedData?.calculation?.prorate_amount;
      const fullPrice = usesBillingTermSelector(selectedPlan)
        ? computePlanTermPriceIdr(selectedPlan, selectedMemberCount, billingTermMonths)
        : selectedBillingCycle === "yearly"
          ? getYearlyPriceForMembers(basePrice, selectedMemberCount, selectedPlan.annual_discount_percentage)
          : getMonthlyPriceForMembers(basePrice, selectedMemberCount);
      const finalAmount = (prorateAmount !== undefined && prorateAmount > 0) ? prorateAmount : fullPrice;

      const catalogAddonMain = catalogAddonChargeForMidtransSplit({
        plan: selectedPlan,
        billingCycle: selectedBillingCycle,
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        billingTermMonths,
        selections: mergeCheckoutSelectionsForSelectedPlan(),
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        legacyLeadMagnetActive: leadMagnetActive,
        legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
        calculation: proRatedData?.calculation,
      });
      const grossMain = finalAmount + catalogAddonMain;
      const itemDetailsMain = buildMidtransExplicitHrAndAddonItemDetails({
        hrChargeAmountIdr: finalAmount,
        catalogAddOnsListAmountIdr: catalogAddonMain,
        billingCycle: selectedBillingCycle,
        planName: selectedPlan.name,
        memberCount: selectedMemberCount,
      });

      const bundledUnitsPay = bundledOmnichannelRosterUnitsFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );
      const bundledLeadMagnetPay = bundledLeadMagnetFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: grossMain,
        memberCount: selectedMemberCount,
        billingCycle: selectedBillingCycle,
        billingTermMonths,
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
              bundled_lead_magnet_included: bundledLeadMagnetPay,
              bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
              bundled_pos_addon_included: bundledPosAddonFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
            }
          : {
              is_member_upgrade: false,
              previous_member_count: selectedMemberCount,
              member_difference: 0,
              remaining_days: 0,
              prorate_amount: 0,
              prorate_percentage: 0,
              bundled_omnichannel_roster_units: bundledUnitsPay,
              bundled_lead_magnet_included: bundledLeadMagnetPay,
              bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
              bundled_pos_addon_included: bundledPosAddonFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
            },
      });
      
      setIsModalOpen(false);
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment/schedule
    }
  }, [selectedPlan, selectedMemberCount, selectedBillingTermMonths, initiateMidtransPayment, proRatedData, schedulePlanChange, subscriptionStatus, currentPlanId, currentMemberCount, currentOrgBillingTermMonths, omnichannelPaidSeats, leadMagnetActive, posPaidOutletCount, posAddonActive, mergeCheckoutSelectionsForSelectedPlan, paidMemberFloor, organizationId, queryClient, t, resolveBillingForPlan, refreshSubscriptionStatus]);

  const handleChooseImmediate = useCallback(async () => {
    setIsOptionsModalOpen(false);
    
    if (!selectedPlan) return;

    const { billingCycle: selectedBillingCycle, billingTermMonths } = resolveBillingForPlan(selectedPlan);

    try {
      const basePrice = selectedPlan.base_price_per_member;
      const prorateAmount = proRatedData?.calculation?.prorate_amount;
      const fullPrice = usesBillingTermSelector(selectedPlan)
        ? computePlanTermPriceIdr(selectedPlan, selectedMemberCount, billingTermMonths)
        : selectedBillingCycle === "yearly"
          ? getYearlyPriceForMembers(basePrice, selectedMemberCount, selectedPlan.annual_discount_percentage)
          : getMonthlyPriceForMembers(basePrice, selectedMemberCount);
      const finalAmount = (prorateAmount !== undefined && prorateAmount > 0) ? prorateAmount : fullPrice;

      const catalogAddonImmediate = catalogAddonChargeForMidtransSplit({
        plan: selectedPlan,
        billingCycle: selectedBillingCycle,
        annualDiscountPercent: selectedPlan.annual_discount_percentage,
        billingTermMonths,
        selections: mergeCheckoutSelectionsForSelectedPlan(),
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        legacyLeadMagnetActive: leadMagnetActive,
        legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
        calculation: proRatedData?.calculation,
      });
      const grossImmediate = finalAmount + catalogAddonImmediate;
      const itemDetailsImmediate = buildMidtransExplicitHrAndAddonItemDetails({
        hrChargeAmountIdr: finalAmount,
        catalogAddOnsListAmountIdr: catalogAddonImmediate,
        billingCycle: selectedBillingCycle,
        planName: selectedPlan.name,
        memberCount: selectedMemberCount,
      });

      const bundledUnitsImmediate = bundledOmnichannelRosterUnitsFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );
      const bundledLeadMagnetImmediate = bundledLeadMagnetFromSelections(
        mergeCheckoutSelectionsForSelectedPlan(),
      );

      await initiateMidtransPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: grossImmediate,
        memberCount: selectedMemberCount,
        billingCycle: selectedBillingCycle,
        billingTermMonths,
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
              bundled_lead_magnet_included: bundledLeadMagnetImmediate,
              bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
              bundled_pos_addon_included: bundledPosAddonFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
            }
          : {
              is_member_upgrade: false,
              previous_member_count: selectedMemberCount,
              member_difference: 0,
              remaining_days: 0,
              prorate_amount: 0,
              prorate_percentage: 0,
              bundled_omnichannel_roster_units: bundledUnitsImmediate,
              bundled_lead_magnet_included: bundledLeadMagnetImmediate,
              bundled_pos_outlet_units: bundledPosOutletUnitsFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
              bundled_pos_addon_included: bundledPosAddonFromSelections(
                mergeCheckoutSelectionsForSelectedPlan(),
              ),
            },
      });
      
      setSelectedPlan(null);
      setProRatedData(null);
    } catch {
      // Error surfaced via toast from payment
    }
  }, [selectedPlan, selectedMemberCount, initiateMidtransPayment, proRatedData, omnichannelPaidSeats, leadMagnetActive, mergeCheckoutSelectionsForSelectedPlan, resolveBillingForPlan]);

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
    return currentEmployeeCount <= newMemberCount;
  };

  const hasSchedulableDowngradeForPlan = useCallback(
    (
      plan: SubscriptionPlan,
      memberCount: number,
      billingCycle: string,
      selections: Record<string, { included: boolean; quantity: number }>,
    ) => {
      const activePlanRow = subscriptionPlans?.find((p) => p.name === subscriptionStatus?.plan_name);
      const isCurrent = isCurrentPlan(plan);
      return hasSchedulableDowngrade({
        isCurrentPlan: isCurrent,
        memberCount,
        currentMemberCount,
        billingCycle,
        currentBillingCycle: subscriptionStatus?.billing_cycle || "monthly",
        plan,
        selections,
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        legacyLeadMagnetActive: leadMagnetActive,
        legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
        isTargetPlanDowngrade: Boolean(
          activePlanRow && !isCurrent && isTargetPlanDowngrade(activePlanRow, plan),
        ),
        currentEmployeeCount,
        rosterCount,
        isExpired: subscriptionStatus?.is_expired,
        isRenewWindow:
          isCurrent &&
          Boolean(subscriptionStatus) &&
          (subscriptionStatus?.is_expired ||
            (!subscriptionStatus?.is_trial &&
              typeof subscriptionStatus?.days_until_expiry === "number" &&
              subscriptionStatus.days_until_expiry >= 0 &&
              subscriptionStatus.days_until_expiry <= RENEWAL_WINDOW_DAYS)),
      });
    },
    [
      subscriptionPlans,
      subscriptionStatus?.plan_name,
      subscriptionStatus?.billing_cycle,
      subscriptionStatus?.is_expired,
      isCurrentPlan,
      currentMemberCount,
      omnichannelPaidSeats,
      leadMagnetActive,
      posPaidOutletCount,
      currentEmployeeCount,
      rosterCount,
    ],
  );

  const subscriptionRemainingDays = resolveCheckoutRemainingDays({
    subscriptionStatus,
  });

  const isMidCycleActive = isMidCycleActiveSubscription(subscriptionStatus);

  const getButtonText = (
    plan: SubscriptionPlan,
    memberCount: number,
    billingCycle: string,
    isRenewEligible: boolean,
    hasCheckoutableAddOnChanges = false,
    selections: Record<string, { included: boolean; quantity: number }> = {},
    billingTermMonths?: BillingTermMonths,
  ) => {
    if (isEnterpriseSubscriptionPlan(plan)) {
      return t("subscription.plans.button.contactSales");
    }

    const isCurrent = isCurrentPlan(plan);
    const currentMemberLimit = subscriptionStatus?.member_count || 0;
    const currentBillingCycle = subscriptionStatus?.billing_cycle || 'monthly';
    const planTermMonths =
      billingTermMonths ?? billingTermMonthsFromLegacyCycle(billingCycle);
    const sameBillingSelection = usesBillingTermSelector(plan)
      ? planTermMonths === currentOrgBillingTermMonths
      : billingCycle === currentBillingCycle;
    const isExpired = Boolean(subscriptionStatus?.is_expired);
    const schedDowngrade = hasSchedulableDowngradeForPlan(plan, memberCount, billingCycle, selections);
    const renewBase =
      isRenewEligible &&
      memberCount === currentMemberLimit &&
      sameBillingSelection &&
      !schedDowngrade;
    const renewAddonsChanged =
      renewBase &&
      (hasCheckoutableAddOnChanges ||
        isAddonSelectionDowngrade(plan, selections, {
          omnichannelPaidSeats,
          leadMagnetActive,
          posPaidOutletCount,
          posAddonActive,
        }));
    
    if (isCurrent) {
      if (renewBase) {
        return renewAddonsChanged
          ? t("subscription.plans.button.renewWithChanges")
          : t("subscription.plans.button.renew");
      }
      if (isExpired && (subscriptionStatus?.base_price_per_member ?? 0) > 0) {
        const addonDiff =
          hasCheckoutableAddOnChanges ||
          isAddonSelectionDowngrade(plan, selections, {
            omnichannelPaidSeats,
            leadMagnetActive,
            posPaidOutletCount,
          });
        return addonDiff
          ? t("subscription.plans.button.renewWithChanges")
          : t("subscription.plans.button.renew");
      }
      if (memberCount > currentMemberLimit) {
        return t("subscription.plans.button.upgrade");
      }
      if (schedDowngrade) {
        return canChangePlan(plan, memberCount)
          ? t("subscription.plans.button.scheduleChange")
          : t("subscription.plans.button.cannotDowngrade");
      }
      if (usesBillingTermSelector(plan) && planTermMonths !== currentOrgBillingTermMonths) {
        return planTermMonths > currentOrgBillingTermMonths
          ? t("subscription.plans.button.upgradeToYearly")
          : t("subscription.plans.button.switchToMonthly");
      }
      if (billingCycle !== currentBillingCycle) {
        return billingCycle === "yearly"
          ? t("subscription.plans.button.upgradeToYearly")
          : t("subscription.plans.button.switchToMonthly");
      }
      if (hasCheckoutableAddOnChanges) {
        return t("subscription.plans.button.purchaseAddOns");
      }
      return t("subscription.plans.button.current");
    }

    if (schedDowngrade) {
      return canChangePlan(plan, memberCount)
        ? t("subscription.plans.button.scheduleChange")
        : t("subscription.plans.button.cannotDowngrade");
    }

    return t("subscription.plans.button.select");
  };

  const hasCheckoutableAddOnChangesForPlan = useCallback(
    (
      plan: SubscriptionPlan,
      memberCount: number,
      billingCycle: string,
      selections: Record<string, { included: boolean; quantity: number }>,
    ) =>
      hasCheckoutableCatalogAddOnDelta({
        isCurrentPlan: isCurrentPlan(plan),
        memberCount,
        currentMemberCount,
        billingCycle,
        currentBillingCycle: subscriptionStatus?.billing_cycle || "monthly",
        plan,
        annualDiscountPercent: plan.annual_discount_percentage,
        selections,
        legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        legacyLeadMagnetActive: leadMagnetActive,
        legacyPosPaidOutletCount: posPaidOutletCount,
            legacyPosAddonActive: posAddonActive,
        isExpired: subscriptionStatus?.is_expired,
        remainingDays: subscriptionRemainingDays,
      }),
    [
      isCurrentPlan,
      currentMemberCount,
      subscriptionStatus?.billing_cycle,
      subscriptionStatus?.is_expired,
      omnichannelPaidSeats,
      leadMagnetActive,
      posPaidOutletCount,
      subscriptionRemainingDays,
    ],
  );
  
  const daysUntilExpiry = subscriptionStatus?.days_until_expiry ?? null;
  const isRenewWindow = typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && daysUntilExpiry <= RENEWAL_WINDOW_DAYS;
  const isPaidExpired =
    Boolean(subscriptionStatus?.is_expired) &&
    (subscriptionStatus?.base_price_per_member ?? 0) > 0;
  // Allow renewal if: (1) within renewal window OR (2) paid subscription expired (incl. stale is_trial flag)
  const isRenewEligibleBase =
    Boolean(subscriptionStatus) &&
    (isRenewWindow || isPaidExpired) &&
    (!subscriptionStatus?.is_trial || isPaidExpired);

  const currentPlanRow = useMemo(
    () => activePlans.find((p) => isCurrentPlan(p)) ?? null,
    [activePlans, isCurrentPlan],
  );

  const showAddOnsSidebar = useMemo(
    () => (currentPlanRow ? shouldShowAddOnsSidebar(currentPlanRow, true) : false),
    [currentPlanRow],
  );

  const sidebarAddOnContext = useMemo(() => {
    if (!currentPlanRow || !showAddOnsSidebar) return null;
    const memberCount =
      memberCounts[currentPlanRow.id] !== undefined
        ? memberCounts[currentPlanRow.id]
        : subscriptionStatus?.member_count || currentMemberCount || 1;
    const { billingCycle, billingTermMonths } = resolvePlanBillingSelection(
      currentPlanRow,
      billingCycles,
      billingTerms,
      currentOrgBillingTermMonths,
    );
    const isTrialPlan =
      !isEnterpriseSubscriptionPlan(currentPlanRow) &&
      (currentPlanRow.name === "Trial" || currentPlanRow.base_price_per_member === 0);
    return {
      plan: currentPlanRow,
      memberCount,
      billingCycle,
      billingTermMonths,
      isTrialPlan,
      mergedAddOns: mergeSelections(currentPlanRow, true, memberCount),
      isRenewEligible: isRenewEligibleBase,
    };
  }, [
    currentPlanRow,
    showAddOnsSidebar,
    memberCounts,
    billingCycles,
    billingTerms,
    subscriptionStatus?.member_count,
    currentMemberCount,
    isRenewEligibleBase,
    mergeSelections,
  ]);

  const relocateAddOnDetailForCurrent = relocateAddOnDetailToPanel({
    showAddOnsSidebar,
    isExpired: subscriptionStatus?.is_expired,
    isRenewEligible:
      Boolean(currentPlanRow && isCurrentPlan(currentPlanRow)) && isRenewEligibleBase,
  });

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
    posPaidOutletCount,
    posAddonActive,
    rosterCount,
    memberCounts,
    billingCycles,
    billingTerms,
    isYearly,
    selectedBillingTermMonths,
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
    currentOrgBillingTermMonths,
    currentEmployeeCount,
    isMidtransConfirmLoading,
    proRateCalculation,
    catalogAddOnBillingChargeIdr,
    catalogAddOnForConfirmationModalIdr,
    isRenewEligibleBase,
    daysUntilExpiry,
    isRenewWindow,
    isMidCycleActive,
    paidMemberFloor,
    showAddOnsSidebar,
    sidebarAddOnContext,
    relocateAddOnDetailForCurrent,
    enterpriseSliderMin,
    resolvePlanSliderMinForPlan,
    resolvePlanMaxMembers,
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
  };
}
