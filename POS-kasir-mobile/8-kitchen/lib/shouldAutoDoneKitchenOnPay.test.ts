import { describe, expect, it } from "vitest";
import { DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE } from "./kitchenFirePolicy";
import { shouldAutoDoneKitchenOnPay } from "./shouldAutoDoneKitchenOnPay";

describe("shouldAutoDoneKitchenOnPay", () => {
  it("auto-dones when kitchen tickets existed before pay", () => {
    expect(
      shouldAutoDoneKitchenOnPay({
        hadKitchenTicketsBeforePay: true,
        sessionWasOpenBeforePay: true,
        salesTypeLabel: "Dine In",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
      }),
    ).toBe(true);
  });

  it("does not auto-done pay-first fire", () => {
    expect(
      shouldAutoDoneKitchenOnPay({
        hadKitchenTicketsBeforePay: false,
        sessionWasOpenBeforePay: false,
        salesTypeLabel: "Takeaway",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
      }),
    ).toBe(false);
  });

  it("auto-dones dine-in open session pay-at-table without prior tickets edge", () => {
    expect(
      shouldAutoDoneKitchenOnPay({
        hadKitchenTicketsBeforePay: false,
        sessionWasOpenBeforePay: true,
        salesTypeLabel: "Dine In",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
      }),
    ).toBe(true);
  });
});
