import { describe, expect, it } from "vitest";
import { calcWeightedAvgCost } from "./weightedAvgCost";

describe("calcWeightedAvgCost", () => {
  it("uses unit cost when previous qty is zero", () => {
    expect(calcWeightedAvgCost(0, 0, 5, 10000)).toBe(10000);
  });

  it("computes weighted average", () => {
    expect(calcWeightedAvgCost(10, 8000, 10, 12000)).toBe(10000);
  });

  it("ignores non-positive add qty", () => {
    expect(calcWeightedAvgCost(4, 5000, 0, 9000)).toBe(5000);
  });
});
