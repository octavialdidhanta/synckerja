import { describe, expect, it } from "vitest";
import {
  OMNICHANNEL_ROSTER_ADD_ON_CODE,
  catalogAddOnIncrementalListAmountIdr,
  catalogAddonChargeForMidtransSplit,
  proratedCatalogAddonChargeIdr,
  usesHrProrateForAddonBilling,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

const omnichannelLink = {
  display_order: 0,
  unit_price_override_per_month: null as number | null,
  subscription_add_ons: {
    code: OMNICHANNEL_ROSTER_ADD_ON_CODE,
    is_active: true,
    default_unit_price_per_month: 250_000,
    follows_plan_annual_discount: true,
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

describe("usesHrProrateForAddonBilling", () => {
  it("returns true only for charge_now + positive prorate without skip_prorate", () => {
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 100, skip_prorate: false })).toBe(true);
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 100, skip_prorate: true })).toBe(false);
    expect(usesHrProrateForAddonBilling({ charge_now: false, prorate_amount: 100 })).toBe(false);
    expect(usesHrProrateForAddonBilling({ charge_now: true, prorate_amount: 0 })).toBe(false);
    expect(usesHrProrateForAddonBilling(null)).toBe(false);
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
});
