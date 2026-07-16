import { describe, expect, it } from "vitest";
import {
  LEAD_MAGNET_ADD_ON_CODE,
  OMNICHANNEL_ROSTER_ADD_ON_CODE,
  catalogAddOnIncrementalListAmountIdr,
  catalogAddonChargeForMidtransSplit,
  deriveSubscriptionDaysRemaining,
  hasCheckoutableCatalogAddOnDelta,
  hasSchedulableDowngrade,
  isAddOnOnlyMidCycleCheckout,
  isAddonSelectionDowngrade,
  isMidCycleActiveSubscription,
  mergePlanAddOnSelections,
  proratedCatalogAddonChargeIdr,
  relocateAddOnDetailToPanel,
  resolveCheckoutRemainingDays,
  summarizeAddOnSelectionsForDisplay,
  isEnterpriseSubscriptionPlan,
  isEnterpriseSubscriptionPlanName,
  resolveEnterpriseSliderMin,
  resolveScaleUpMaxMembersFromPlans,
  sortSubscriptionPlansForDisplay,
  shouldShowAddOnsSidebar,
  usesHrProrateForAddonBilling,
  usesMidCycleIncrementalAddonProrate,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

const omnichannelLink = {
  display_order: 0,
  unit_price_override_per_month: null as number | null,
  subscription_add_ons: {
    code: OMNICHANNEL_ROSTER_ADD_ON_CODE,
    name: "Omnichannel",
    is_active: true,
    default_unit_price_per_month: 250_000,
    follows_plan_annual_discount: true,
  },
};

const leadMagnetLink = {
  display_order: 10,
  unit_price_override_per_month: null as number | null,
  subscription_add_ons: {
    code: LEAD_MAGNET_ADD_ON_CODE,
    name: "Lead Magnet",
    is_active: true,
    default_unit_price_per_month: 99_000,
    follows_plan_annual_discount: true,
    billing_unit: "per_organization_month",
  },
};

function planWithOmnichannel(): Pick<
  SubscriptionPlan,
  "name" | "base_price_per_member" | "plan_add_ons"
> {
  return {
    name: "Scale Up Plan",
    base_price_per_member: 50_000,
    plan_add_ons: [omnichannelLink as SubscriptionPlan["plan_add_ons"][number]],
  };
}

function planWithOmnichannelAndLeadMagnet(): Pick<
  SubscriptionPlan,
  "name" | "base_price_per_member" | "plan_add_ons"
> {
  return {
    name: "Scale Up Plan",
    base_price_per_member: 50_000,
    plan_add_ons: [
      omnichannelLink as SubscriptionPlan["plan_add_ons"][number],
      leadMagnetLink as SubscriptionPlan["plan_add_ons"][number],
    ],
  };
}

describe("resolveCheckoutRemainingDays", () => {
  it("returns subscription status days when RPC prorate reports 0", () => {
    const days = resolveCheckoutRemainingDays({
      subscriptionStatus: {
        is_expired: false,
        is_trial: false,
        days_remaining: 729,
        days_until_expiry: 729,
        subscription_end_date: "2028-07-13",
      },
      prorateRemainingDays: 0,
    });
    expect(days).toBe(729);
  });

  it("uses max of RPC and status", () => {
    const days = resolveCheckoutRemainingDays({
      subscriptionStatus: { is_expired: false, days_remaining: 15 },
      prorateRemainingDays: 29,
    });
    expect(days).toBe(29);
  });
});

describe("isMidCycleActiveSubscription", () => {
  it("is true when days remaining and not expired", () => {
    expect(
      isMidCycleActiveSubscription({ is_expired: false, days_remaining: 729 }),
    ).toBe(true);
  });

  it("is false when expired", () => {
    expect(
      isMidCycleActiveSubscription({ is_expired: true, days_remaining: 10 }),
    ).toBe(false);
  });
});

describe("usesHrProrateForAddonBilling", () => {
  it("returns true only for charge_now + positive prorate without skip_prorate", () => {
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 100, skip_prorate: false })).toBe(true);
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 100, skip_prorate: true })).toBe(false);
    expect(usesHrProrateForAddonBilling({ charge_now: false, prorate_amount: 100 })).toBe(false);
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 0 })).toBe(false);
    expect(usesHrProrateForAddonBilling(null)).toBe(false);
  });
});

describe("usesMidCycleIncrementalAddonProrate", () => {
  it("returns true for addon_only_checkout even when HR prorate is zero", () => {
    expect(
      usesMidCycleIncrementalAddonProrate({
        charge_now: true,
        prorate_amount: 0,
        addon_only_checkout: true,
        remaining_days: 29,
      }),
    ).toBe(true);
  });
});

describe("hasCheckoutableCatalogAddOnDelta", () => {
  const base = {
    isCurrentPlan: true,
    memberCount: 9,
    currentMemberCount: 9,
    billingCycle: "monthly",
    currentBillingCycle: "monthly",
    annualDiscountPercent: 20,
    legacyOmnichannelPaidSeatCount: 9,
    legacyLeadMagnetActive: false,
    isExpired: false,
    remainingDays: 29,
  };

  it("returns false when no incremental add-on delta", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    expect(
      hasCheckoutableCatalogAddOnDelta({
        ...base,
        plan,
        selections: {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 },
          [LEAD_MAGNET_ADD_ON_CODE]: { included: false, quantity: 1 },
        },
      }),
    ).toBe(false);
  });

  it("returns true when new lead magnet is toggled on", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    expect(
      hasCheckoutableCatalogAddOnDelta({
        ...base,
        plan,
        selections: {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 },
          [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
        },
      }),
    ).toBe(true);
  });

  it("returns false when remaining days is zero", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    expect(
      hasCheckoutableCatalogAddOnDelta({
        ...base,
        remainingDays: 0,
        plan,
        selections: {
          [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
        },
      }),
    ).toBe(false);
  });
});

describe("isAddOnOnlyMidCycleCheckout", () => {
  it("mirrors hasCheckoutableCatalogAddOnDelta for mid-cycle checkout", () => {
    const plan = planWithOmnichannel();
    expect(
      isAddOnOnlyMidCycleCheckout({
        isCurrentPlan: true,
        memberCount: 9,
        currentMemberCount: 9,
        billingCycle: "monthly",
        currentBillingCycle: "monthly",
        plan,
        annualDiscountPercent: 20,
        selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 10 } },
        legacyOmnichannelPaidSeatCount: 9,
        remainingDays: 15,
      }),
    ).toBe(true);
  });
});

describe("catalogAddOnIncrementalListAmountIdr", () => {
  it("returns 0 when selected omnichannel seats equal paid baseline", () => {
    const plan = planWithOmnichannel();
    const v = catalogAddOnIncrementalListAmountIdr({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 } },
      legacyOmnichannelPaidSeatCount: 9,
    });
    expect(v).toBe(0);
  });

  it("returns monthly list for delta seats only", () => {
    const plan = planWithOmnichannel();
    const v = catalogAddOnIncrementalListAmountIdr({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 10 } },
      legacyOmnichannelPaidSeatCount: 9,
    });
    expect(v).toBe(250_000);
  });
});

describe("proratedCatalogAddonChargeIdr", () => {
  it("prorates monthly incremental by remaining_days/30", () => {
    const charge = proratedCatalogAddonChargeIdr({
      incrementalListAmountIdr: 250_000,
      billingCycle: "monthly",
      remainingDays: 29,
    });
    expect(charge).toBe(Math.round((250_000 * 29) / 30));
  });

  it("returns 0 when no remaining days", () => {
    expect(
      proratedCatalogAddonChargeIdr({
        incrementalListAmountIdr: 250_000,
        billingCycle: "monthly",
        remainingDays: 0,
      }),
    ).toBe(0);
  });
});

describe("catalogAddonChargeForMidtransSplit", () => {
  it("on HR prorate path charges prorated incremental add-on only", () => {
    const plan = planWithOmnichannel();
    const calc = { charge_now: true, prorate_amount: 48_333, skip_prorate: false, remaining_days: 29 };
    const charge = catalogAddonChargeForMidtransSplit({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 } },
      legacyOmnichannelPaidSeatCount: 9,
      calculation: calc,
    });
    expect(charge).toBe(0);
  });

  it("without HR prorate uses full catalog list amount", () => {
    const plan = planWithOmnichannel();
    const charge = catalogAddonChargeForMidtransSplit({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 } },
      legacyOmnichannelPaidSeatCount: 9,
      calculation: null,
    });
    expect(charge).toBe(9 * 250_000);
  });

  it("on addon_only_checkout path charges prorated incremental lead magnet only", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    const calc = {
      charge_now: true,
      prorate_amount: 0,
      addon_only_checkout: true,
      remaining_days: 30,
    };
    const charge = catalogAddonChargeForMidtransSplit({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: {
        [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 },
        [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
      },
      legacyOmnichannelPaidSeatCount: 9,
      legacyLeadMagnetActive: false,
      calculation: calc,
    });
    expect(charge).toBe(99_000);
  });

  it("prorates new lead magnet for 729 remaining days (monthly exact)", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    const charge = catalogAddonChargeForMidtransSplit({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: {
        [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 9 },
        [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
      },
      legacyOmnichannelPaidSeatCount: 9,
      legacyLeadMagnetActive: false,
      calculation: {
        charge_now: true,
        prorate_amount: 0,
        addon_only_checkout: true,
        remaining_days: 729,
      },
    });
    expect(charge).toBe(Math.round((99_000 * 729) / 30));
    expect(charge).toBe(2_405_700);
  });

  it("on addon_only_checkout prorates omnichannel seat delta", () => {
    const plan = planWithOmnichannel();
    const calc = {
      charge_now: true,
      prorate_amount: 0,
      addon_only_checkout: true,
      remaining_days: 29,
    };
    const charge = catalogAddonChargeForMidtransSplit({
      plan,
      billingCycle: "monthly",
      annualDiscountPercent: 20,
      selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 10 } },
      legacyOmnichannelPaidSeatCount: 9,
      calculation: calc,
    });
    expect(charge).toBe(Math.round((250_000 * 29) / 30));
  });
});

describe("mergePlanAddOnSelections v2", () => {
  it("prefers stored quantity above DB baseline for omnichannel upgrade", () => {
    const plan = planWithOmnichannel();
    const merged = mergePlanAddOnSelections(
      plan,
      { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 2 } },
      true,
      1,
      5,
      false,
    );
    expect(merged[OMNICHANNEL_ROSTER_ADD_ON_CODE]).toEqual({ included: true, quantity: 2 });
  });

  it("allows stored included false for schedule/renew off", () => {
    const plan = planWithOmnichannel();
    const merged = mergePlanAddOnSelections(
      plan,
      { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: false, quantity: 1 } },
      true,
      1,
      5,
      false,
    );
    expect(merged[OMNICHANNEL_ROSTER_ADD_ON_CODE].included).toBe(false);
  });

  it("seeds from DB when no stored row", () => {
    const plan = planWithOmnichannel();
    const merged = mergePlanAddOnSelections(plan, undefined, true, 3, 5, false);
    expect(merged[OMNICHANNEL_ROSTER_ADD_ON_CODE]).toEqual({ included: true, quantity: 3 });
  });
});

describe("isAddonSelectionDowngrade", () => {
  it("detects omnichannel disable and seat decrease", () => {
    const plan = planWithOmnichannelAndLeadMagnet();
    const baselines = { omnichannelPaidSeats: 2, leadMagnetActive: true };
    expect(
      isAddonSelectionDowngrade(
        plan,
        { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: false, quantity: 1 } },
        baselines,
      ),
    ).toBe(true);
    expect(
      isAddonSelectionDowngrade(
        plan,
        { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 1 } },
        baselines,
      ),
    ).toBe(true);
    expect(
      isAddonSelectionDowngrade(
        plan,
        {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 2 },
          [LEAD_MAGNET_ADD_ON_CODE]: { included: false, quantity: 1 },
        },
        baselines,
      ),
    ).toBe(true);
  });
});

describe("hasSchedulableDowngrade", () => {
  const plan = planWithOmnichannelAndLeadMagnet();
  const base = {
    isCurrentPlan: true,
    memberCount: 5,
    currentMemberCount: 5,
    billingCycle: "monthly",
    currentBillingCycle: "monthly",
    plan,
    legacyOmnichannelPaidSeatCount: 1,
    legacyLeadMagnetActive: false,
    currentEmployeeCount: 0,
  };

  it("true for member decrease mid-cycle", () => {
    expect(
      hasSchedulableDowngrade({
        ...base,
        memberCount: 2,
        selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 1 } },
      }),
    ).toBe(true);
  });

  it("false when incremental addon upgrade only", () => {
    expect(
      hasSchedulableDowngrade({
        ...base,
        selections: {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 2 },
          [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
        },
      }),
    ).toBe(false);
  });

  it("false for addon-only downgrade in renew window (handled via renew checkout)", () => {
    expect(
      hasSchedulableDowngrade({
        ...base,
        isRenewWindow: true,
        selections: {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: false, quantity: 0 },
        },
      }),
    ).toBe(false);
  });

  it("false when subscription is expired (no schedule at period end)", () => {
    expect(
      hasSchedulableDowngrade({
        ...base,
        isExpired: true,
        selections: {
          [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: false, quantity: 0 },
        },
      }),
    ).toBe(false);
  });

  it("false for member decrease when expired", () => {
    expect(
      hasSchedulableDowngrade({
        ...base,
        isExpired: true,
        memberCount: 2,
        selections: { [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 1 } },
      }),
    ).toBe(false);
  });
});

describe("deriveSubscriptionDaysRemaining", () => {
  it("returns 0 when is_expired even if end date is in the past (negative calendar days)", () => {
    expect(
      deriveSubscriptionDaysRemaining({
        is_expired: true,
        is_trial: true,
        trial_end_date: "2026-07-10T00:00:00.000Z",
        subscription_end_date: "2026-07-10T00:00:00.000Z",
        end_date: "2026-07-10T00:00:00.000Z",
      }),
    ).toBe(0);
  });

  it("clamps negative calendar days to 0 when not yet flagged expired", () => {
    expect(
      deriveSubscriptionDaysRemaining({
        is_expired: false,
        is_trial: true,
        trial_end_date: "2026-07-10T00:00:00.000Z",
        subscription_end_date: undefined,
        end_date: "2026-07-10T00:00:00.000Z",
      }),
    ).toBe(0);
  });

  it("prefers subscription_end_date over trial_end_date when paid end exists", () => {
    const days = deriveSubscriptionDaysRemaining({
      is_expired: false,
      is_trial: true,
      trial_end_date: "2026-05-26T00:00:00.000Z",
      subscription_end_date: "2026-08-10T00:00:00.000Z",
      end_date: undefined,
    });
    expect(days).toBeGreaterThan(0);
  });
});

describe("relocateAddOnDetailToPanel", () => {
  it("true when adjacent add-on panel is shown", () => {
    expect(
      relocateAddOnDetailToPanel({
        showAdjacentAddOns: true,
        isExpired: false,
        isRenewEligible: false,
      }),
    ).toBe(true);
  });

  it("true when expired even without adjacent panel flag", () => {
    expect(
      relocateAddOnDetailToPanel({
        showAdjacentAddOns: false,
        isExpired: true,
        isRenewEligible: false,
      }),
    ).toBe(true);
  });

  it("true when renew eligible", () => {
    expect(
      relocateAddOnDetailToPanel({
        showAdjacentAddOns: false,
        isExpired: false,
        isRenewEligible: true,
      }),
    ).toBe(true);
  });

  it("false when no adjacent panel and not expired/renew", () => {
    expect(
      relocateAddOnDetailToPanel({
        showAdjacentAddOns: false,
        isExpired: false,
        isRenewEligible: false,
      }),
    ).toBe(false);
  });
});

describe("summarizeAddOnSelectionsForDisplay", () => {
  const plan = planWithOmnichannelAndLeadMagnet();

  it("returns only included add-ons", () => {
    const rows = summarizeAddOnSelectionsForDisplay(
      plan,
      {
        [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: false, quantity: 1 },
        [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
      },
      5,
      "monthly",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe(LEAD_MAGNET_ADD_ON_CODE);
    expect(rows[0].isFlatOrg).toBe(true);
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].amountIdr).toBeGreaterThan(0);
  });

  it("clamps omnichannel quantity to member count", () => {
    const rows = summarizeAddOnSelectionsForDisplay(
      plan,
      {
        [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: true, quantity: 10 },
        [LEAD_MAGNET_ADD_ON_CODE]: { included: false, quantity: 1 },
      },
      5,
      "monthly",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].isOmnichannel).toBe(true);
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].amountIdr).toBeGreaterThan(0);
  });
});

describe("isEnterpriseSubscriptionPlanName", () => {
  it("matches enterprise plan variants", () => {
    expect(isEnterpriseSubscriptionPlanName("Enterprise Plan")).toBe(true);
    expect(isEnterpriseSubscriptionPlanName("enterprise")).toBe(true);
    expect(isEnterpriseSubscriptionPlanName("Scale Up Plan")).toBe(false);
  });
});

describe("isEnterpriseSubscriptionPlan", () => {
  it("true when is_custom flag set", () => {
    expect(isEnterpriseSubscriptionPlan({ name: "Custom Corp", is_custom: true })).toBe(true);
  });
});

describe("enterprise slider bounds", () => {
  it("derive Scale Up cap from plan max_members", () => {
    expect(
      resolveScaleUpMaxMembersFromPlans([
        { name: "Scale Up Plan", max_members: 50, base_price_per_member: 99_000 },
        { name: "Start Up Plan", max_members: null, base_price_per_member: 49_000 },
      ]),
    ).toBe(50);
  });

  it("enterprise min is Scale Up max + 1", () => {
    expect(
      resolveEnterpriseSliderMin([
        { name: "Scale Up Plan", max_members: 50, base_price_per_member: 99_000 },
      ]),
    ).toBe(51);
  });
});

describe("sortSubscriptionPlansForDisplay", () => {
  it("places enterprise last after scale up and paid tiers", () => {
    const sorted = sortSubscriptionPlansForDisplay([
      { name: "Enterprise Plan", base_price_per_member: 0, is_custom: true },
      { name: "Scale Up Plan", base_price_per_member: 99_000, is_custom: false },
      { name: "Start Up Plan", base_price_per_member: 49_000, is_custom: false },
      { name: "Trial", base_price_per_member: 0, is_custom: false },
    ]);
    expect(sorted.map((p) => p.name)).toEqual([
      "Trial",
      "Start Up Plan",
      "Scale Up Plan",
      "Enterprise Plan",
    ]);
  });
});

describe("shouldShowAddOnsSidebar", () => {
  it("true only for current plan with catalog add-ons", () => {
    const plan = planWithOmnichannel();
    expect(shouldShowAddOnsSidebar(plan, true)).toBe(true);
    expect(shouldShowAddOnsSidebar(plan, false)).toBe(false);
  });
});

describe("isEnterpriseSubscriptionPlanName", () => {
  it("matches enterprise plan variants", () => {
    expect(isEnterpriseSubscriptionPlanName("Enterprise Plan")).toBe(true);
    expect(isEnterpriseSubscriptionPlanName("enterprise")).toBe(true);
    expect(isEnterpriseSubscriptionPlanName("Scale Up Plan")).toBe(false);
  });
});

describe("isEnterpriseSubscriptionPlan", () => {
  it("true when is_custom flag set", () => {
    expect(isEnterpriseSubscriptionPlan({ name: "Custom Corp", is_custom: true })).toBe(true);
  });
});

describe("sortSubscriptionPlansForDisplay", () => {
  it("places enterprise last after scale up and paid tiers", () => {
    const sorted = sortSubscriptionPlansForDisplay([
      { name: "Enterprise Plan", base_price_per_member: 0, is_custom: true },
      { name: "Scale Up Plan", base_price_per_member: 99_000, is_custom: false },
      { name: "Start Up Plan", base_price_per_member: 49_000, is_custom: false },
      { name: "Trial", base_price_per_member: 0, is_custom: false },
    ]);
    expect(sorted.map((p) => p.name)).toEqual([
      "Trial",
      "Start Up Plan",
      "Scale Up Plan",
      "Enterprise Plan",
    ]);
  });
});

describe("shouldShowAddOnsSidebar", () => {
  it("true only for current plan with catalog add-ons", () => {
    const plan = planWithOmnichannel();
    expect(shouldShowAddOnsSidebar(plan, true)).toBe(true);
    expect(shouldShowAddOnsSidebar(plan, false)).toBe(false);
  });
});
