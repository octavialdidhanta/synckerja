import { describe, expect, it } from "vitest";
import { calculateTaxByMethod } from "./taxMethods";

describe("calculateTaxByMethod", () => {
  it("gross method deducts tax from employee", () => {
    const result = calculateTaxByMethod({
      monthlyGross: 15_800_000,
      ptkpStatus: "TK/0",
      taxMethod: "gross",
    });
    expect(result.monthlyTax).toBeGreaterThan(0);
    expect(result.employerTaxCost).toBe(0);
  });

  it("gross_up sets employee tax to 0 and employer bears cost", () => {
    const target = 14_000_000;
    const result = calculateTaxByMethod({
      monthlyGross: target,
      ptkpStatus: "TK/0",
      taxMethod: "gross_up",
      targetTakeHome: target,
    });
    expect(result.monthlyTax).toBe(0);
    expect(result.employerTaxCost).toBeGreaterThan(0);
    expect(result.takeHomePay).toBeGreaterThanOrEqual(target - 500_000);
  });

  it("netto converges toward target take-home", () => {
    const target = 10_000_000;
    const result = calculateTaxByMethod({
      monthlyGross: target,
      ptkpStatus: "K/1",
      taxMethod: "netto",
      targetTakeHome: target,
    });
    expect(Math.abs(result.takeHomePay - target)).toBeLessThanOrEqual(200);
  });
});
