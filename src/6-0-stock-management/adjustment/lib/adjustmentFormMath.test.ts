import { describe, expect, it } from "vitest";
import { calcDeltaQty, isNonZeroQty, toInventoryQty } from "./adjustmentFormMath";

describe("adjustmentFormMath", () => {
  it("normalizes qty to 3 decimals", () => {
    expect(toInventoryQty(1.23456)).toBe(1.235);
  });

  it("calculates delta from current to actual", () => {
    expect(calcDeltaQty(10, 12.5)).toBe(2.5);
  });

  it("treats delta that rounds to zero as zero", () => {
    // 0.0004 rounded to 3 decimals becomes 0
    expect(isNonZeroQty(0.0004)).toBe(false);
    expect(isNonZeroQty(-0.0004)).toBe(false);
    expect(isNonZeroQty(0.001)).toBe(true);
  });
});

