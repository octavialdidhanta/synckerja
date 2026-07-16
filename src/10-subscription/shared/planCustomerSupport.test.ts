import { describe, expect, it } from "vitest";
import {
  planHasCustomerSupportFeature,
  resolvePlanCustomerSupportLabelKey,
} from "@/10-subscription/shared/planCustomerSupport";

const basePlan = {
  name: "Scale Up Plan",
  is_custom: false,
  base_price_per_member: 99000,
  plan_module_access: { customerSupport: true } as { customerSupport: boolean },
};

describe("planHasCustomerSupportFeature", () => {
  it("returns true when toggle is on", () => {
    expect(planHasCustomerSupportFeature({ plan_module_access: { customerSupport: true } })).toBe(true);
  });

  it("returns false when toggle is off or missing", () => {
    expect(planHasCustomerSupportFeature({ plan_module_access: { customerSupport: false } })).toBe(false);
    expect(planHasCustomerSupportFeature({})).toBe(false);
  });
});

describe("resolvePlanCustomerSupportLabelKey", () => {
  it("returns null when toggle is off", () => {
    expect(
      resolvePlanCustomerSupportLabelKey({
        ...basePlan,
        plan_module_access: { customerSupport: false },
      }),
    ).toBeNull();
  });

  it("returns limited for free non-enterprise plans", () => {
    expect(
      resolvePlanCustomerSupportLabelKey({
        name: "Start Up Plan",
        is_custom: false,
        base_price_per_member: 0,
        plan_module_access: { customerSupport: true },
      }),
    ).toBe("subscription.plans.features.customerSupport.limited");
  });

  it("returns standard for paid non-enterprise plans", () => {
    expect(resolvePlanCustomerSupportLabelKey(basePlan)).toBe(
      "subscription.plans.features.customerSupport.standard",
    );
  });

  it("returns 247 for enterprise by name", () => {
    expect(
      resolvePlanCustomerSupportLabelKey({
        name: "Enterprise Plan",
        is_custom: false,
        base_price_per_member: 0,
        plan_module_access: { customerSupport: true },
      }),
    ).toBe("subscription.plans.features.customerSupport.247");
  });

  it("returns 247 for is_custom plans even with price", () => {
    expect(
      resolvePlanCustomerSupportLabelKey({
        name: "Custom Sales Plan",
        is_custom: true,
        base_price_per_member: 50000,
        plan_module_access: { customerSupport: true },
      }),
    ).toBe("subscription.plans.features.customerSupport.247");
  });
});
