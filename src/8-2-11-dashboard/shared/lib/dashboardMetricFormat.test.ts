import { describe, expect, it } from "vitest";
import { averageSalePerTransaction } from "./dashboardMetricFormat";

describe("averageSalePerTransaction", () => {
  it("divides net sales by transaction count", () => {
    expect(averageSalePerTransaction(250_000, 5)).toBe(50_000);
  });

  it("returns zero for a non-positive transaction count", () => {
    expect(averageSalePerTransaction(250_000, 0)).toBe(0);
    expect(averageSalePerTransaction(250_000, -1)).toBe(0);
  });
});
