import { describe, expect, it } from "vitest";
import {
  billingCycleFromTerm,
  billingTermMonthsFromLegacyCycle,
  computeTermPriceIdr,
  defaultBillingTermForPlan,
  resolveBillingPeriodMonths,
  resolveTermDiscount,
} from "@/10-subscription/shared/billingTermUtils";

describe("billingTermUtils", () => {
  it("computeTermPriceIdr applies term discount to full period", () => {
    expect(computeTermPriceIdr(99000, 5, 3, 10)).toBe(99000 * 5 * 3 * 0.9);
  });

  it("defaultBillingTermForPlan returns 3 for Enterprise", () => {
    expect(
      defaultBillingTermForPlan({ name: "Enterprise", is_custom: true }),
    ).toBe(3);
    expect(
      defaultBillingTermForPlan({ name: "Enterprise", is_custom: true }, 1),
    ).toBe(3);
    expect(
      defaultBillingTermForPlan({ name: "Enterprise", is_custom: true }, 6),
    ).toBe(6);
  });

  it("resolveTermDiscount reads jsonb keys with annual fallback for 12m", () => {
    const plan = {
      billing_term_discounts: { "3": 5, "6": 10, "12": null },
      annual_discount_percentage: 15,
    };
    expect(resolveTermDiscount(plan, 3)).toBe(5);
    expect(resolveTermDiscount(plan, 6)).toBe(10);
    expect(resolveTermDiscount(plan, 12)).toBe(15);
    expect(resolveTermDiscount(plan, 1)).toBeNull();
  });

  it("billingCycleFromTerm maps 12 to yearly and shorter terms to monthly", () => {
    expect(billingCycleFromTerm(6)).toBe("monthly");
    expect(billingCycleFromTerm(12)).toBe("yearly");
    expect(billingTermMonthsFromLegacyCycle("yearly")).toBe(12);
    expect(billingTermMonthsFromLegacyCycle("monthly")).toBe(1);
  });

  it("resolveBillingPeriodMonths prefers explicit term over billing cycle", () => {
    expect(resolveBillingPeriodMonths("monthly", 6)).toBe(6);
    expect(resolveBillingPeriodMonths("yearly", 3)).toBe(3);
    expect(resolveBillingPeriodMonths("monthly")).toBe(1);
  });
});
