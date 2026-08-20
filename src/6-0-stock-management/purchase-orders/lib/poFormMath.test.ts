import { describe, expect, it } from "vitest";
import { calcLineSubtotal, calcPoTotal, hasValidPoLines } from "./poFormMath";

describe("poFormMath", () => {
  it("calculates line subtotal rounded to cents", () => {
    expect(calcLineSubtotal(5, 10000)).toBe(50000);
    expect(calcLineSubtotal(1.5, 1000)).toBe(1500);
    expect(calcLineSubtotal(0, 1000)).toBe(0);
    expect(calcLineSubtotal(-1, 1000)).toBe(0);
  });

  it("sums purchase order total", () => {
    expect(
      calcPoTotal([
        { qty: 2, unitCost: 10000 },
        { qty: 1, unitCost: 5000 },
      ]),
    ).toBe(25000);
  });

  it("detects valid lines", () => {
    expect(hasValidPoLines([{ qty: 0 }, { qty: 2 }])).toBe(true);
    expect(hasValidPoLines([{ qty: 0 }])).toBe(false);
  });
});
