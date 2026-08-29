import { describe, expect, it } from "vitest";
import { shouldDeductOnPay } from "../lib/shouldDeductOnPay";

describe("shouldDeductOnPay", () => {
  it("always true for pay commit point", () => {
    expect(shouldDeductOnPay({ commitPoint: "pay", hasUncommittedPayLines: false })).toBe(true);
  });

  it("false for fulfillment", () => {
    expect(shouldDeductOnPay({ commitPoint: "fulfillment", hasUncommittedPayLines: true })).toBe(
      false,
    );
  });

  it("kitchen depends on uncommitted lines", () => {
    expect(shouldDeductOnPay({ commitPoint: "kitchen", hasUncommittedPayLines: false })).toBe(
      false,
    );
    expect(shouldDeductOnPay({ commitPoint: "kitchen", hasUncommittedPayLines: true })).toBe(true);
  });
});
