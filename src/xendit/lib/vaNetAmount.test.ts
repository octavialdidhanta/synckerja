import { describe, expect, it } from "vitest";
import { computeVaNetAmount } from "./vaNetAmount";

describe("computeVaNetAmount", () => {
  it("subtracts platform fee from gross", () => {
    expect(computeVaNetAmount(100_000, 2_000)).toBe(98_000);
  });

  it("never returns negative", () => {
    expect(computeVaNetAmount(1_500, 2_000)).toBe(0);
  });

  it("handles zero fee", () => {
    expect(computeVaNetAmount(50_000, 0)).toBe(50_000);
  });
});
