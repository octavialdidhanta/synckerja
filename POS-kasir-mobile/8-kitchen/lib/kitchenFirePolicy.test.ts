import { describe, expect, it } from "vitest";
import {
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  parseKitchenFireBySalesType,
  resolveKitchenFireTrigger,
  shouldFireKitchen,
  shouldFireKitchenOnPay,
} from "./kitchenFirePolicy";

describe("kitchenFirePolicy", () => {
  it("parses valid json", () => {
    expect(
      parseKitchenFireBySalesType({
        dine_in: "on_pay",
        takeaway: "save_bill",
        delivery: "on_pay",
        pickup: "on_pay",
      }).takeaway,
    ).toBe("save_bill");
  });

  it("defaults hybrid policy", () => {
    expect(DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE.dine_in).toBe("save_bill");
    expect(DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE.takeaway).toBe("on_pay");
    expect(DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE.delivery).toBe("on_pay");
    expect(DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE.pickup).toBe("on_pay");
  });

  it("shouldFireKitchen matches bucket rule", () => {
    expect(
      shouldFireKitchen({
        event: "save_bill",
        salesTypeLabel: "Dine In",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldFireKitchen({
        event: "on_pay",
        salesTypeLabel: "Takeaway",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
      }),
    ).toBe(true);
  });

  it("shouldFireKitchenOnPay allows pay-first when no prior fire", () => {
    expect(
      shouldFireKitchenOnPay({
        salesTypeLabel: "Dine In",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
        hadKitchenTicketsBeforePay: false,
      }),
    ).toBe(true);
    expect(
      shouldFireKitchenOnPay({
        salesTypeLabel: "Dine In",
        settings: DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
        hadKitchenTicketsBeforePay: true,
      }),
    ).toBe(false);
  });

  it("resolveKitchenFireTrigger from label", () => {
    expect(resolveKitchenFireTrigger("Delivery", DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE)).toBe(
      "on_pay",
    );
  });
});
