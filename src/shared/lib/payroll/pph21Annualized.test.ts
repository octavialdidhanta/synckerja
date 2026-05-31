import { describe, expect, it } from "vitest";
import { calculatePPh21 } from "./pph21Annualized";

describe("calculatePPh21 PTKP matrix", () => {
  const gross = 10_000_000;

  it("K/3 has lower tax than TK/0 at same gross", () => {
    const gross = 10_000_000;
    const tk0 = calculatePPh21({ monthlyGross: gross, ptkpStatus: "TK/0" }).monthlyTax;
    const k3 = calculatePPh21({ monthlyGross: gross, ptkpStatus: "K/3" }).monthlyTax;
    expect(k3).toBeLessThan(tk0);
  });

  it("TK/0 has tax at 10jt gross", () => {
    const result = calculatePPh21({ monthlyGross: gross, ptkpStatus: "TK/0" });
    expect(result.monthlyTax).toBeGreaterThan(0);
  });

  it("K/3 lowest tax for same gross", () => {
    const tk0 = calculatePPh21({ monthlyGross: gross, ptkpStatus: "TK/0" }).monthlyTax;
    const k3 = calculatePPh21({ monthlyGross: gross, ptkpStatus: "K/3" }).monthlyTax;
    expect(k3).toBeLessThan(tk0);
  });
});

describe("BPJS caps", () => {
  it("caps kesehatan at 12jt base", () => {
    const low = calculatePPh21({ monthlyGross: 12_000_000, ptkpStatus: "TK/0" });
    const high = calculatePPh21({ monthlyGross: 20_000_000, ptkpStatus: "TK/0" });
    expect(low.monthlyBpjsKesehatan).toBe(240_000);
    expect(high.monthlyBpjsKesehatan).toBe(240_000);
  });

  it("caps pensiun at 8.93jt base", () => {
    const high = calculatePPh21({ monthlyGross: 20_000_000, ptkpStatus: "TK/0" });
    expect(high.monthlyBpjsPensiun).toBe(89_306);
  });
});
