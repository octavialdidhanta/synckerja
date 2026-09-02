import { describe, expect, it } from "vitest";
import {
  canContinueCustomer,
  canSubmitPayment,
  nextCheckoutStep,
  prevCheckoutStep,
} from "./orderCheckoutSteps";

describe("orderCheckoutSteps", () => {
  it("advances review → payment", () => {
    expect(nextCheckoutStep("review")).toBe("payment");
    expect(nextCheckoutStep("payment")).toBeNull();
  });

  it("goes back payment → review", () => {
    expect(prevCheckoutStep("payment")).toBe("review");
    expect(prevCheckoutStep("review")).toBeNull();
  });

  it("requires a guest name before customer continue", () => {
    expect(canContinueCustomer("")).toBe(false);
    expect(canContinueCustomer("  ")).toBe(false);
    expect(canContinueCustomer("Linda")).toBe(true);
  });

  it("requires a QRIS choice for online pay", () => {
    expect(canSubmitPayment({ kind: "online", qrisSelected: false })).toBe(false);
    expect(canSubmitPayment({ kind: "online", qrisSelected: true })).toBe(true);
    expect(canSubmitPayment({ kind: "cashier", qrisSelected: false })).toBe(true);
  });
});
