import { describe, expect, it } from "vitest";
import {
  calculateTerPph21,
  calculateThrAmount,
  terCategoryForEmployee,
} from "./terPph21";

describe("terCategoryForEmployee", () => {
  it("maps TK/0 to category A", () => {
    expect(terCategoryForEmployee("pegawai_tetap", "TK/0")).toBe("A");
  });
  it("maps pegawai_tidak_tetap to C", () => {
    expect(terCategoryForEmployee("pegawai_tidak_tetap", "TK/0")).toBe("C");
  });
  it("maps K/1 to category C", () => {
    expect(terCategoryForEmployee("pegawai_tetap", "K/1")).toBe("C");
  });
});

describe("calculateTerPph21", () => {
  it("returns 0 tax for gross under 5.4jt category A", () => {
    const result = calculateTerPph21({
      monthlyGross: 5_000_000,
      ptkpStatus: "TK/0",
      employeeTaxStatus: "pegawai_tetap",
    });
    expect(result.monthlyTax).toBe(0);
    expect(result.terCategory).toBe("A");
  });

  it("applies TER rate for 15.8jt gross category A", () => {
    const result = calculateTerPph21({
      monthlyGross: 15_800_000,
      ptkpStatus: "TK/0",
      employeeTaxStatus: "pegawai_tetap",
    });
    expect(result.monthlyTax).toBeGreaterThan(0);
    expect(result.terRate).toBeGreaterThan(0);
    expect(result.takeHomePay).toBeLessThan(15_800_000);
  });
});

describe("calculateThrAmount", () => {
  it("full month salary mode returns basic", () => {
    expect(
      calculateThrAmount(10_000_000, "full_month_salary", "2020-01-01", "2026-06-30"),
    ).toBe(10_000_000);
  });

  it("proportional for mid-year join", () => {
    const thr = calculateThrAmount(
      12_000_000,
      "proportional",
      "2026-04-01",
      "2026-06-30",
    );
    expect(thr).toBeGreaterThan(0);
    expect(thr).toBeLessThan(12_000_000);
  });

  it("manual_only returns 0", () => {
    expect(calculateThrAmount(10_000_000, "manual_only", null, "2026-06-30")).toBe(0);
  });
});
