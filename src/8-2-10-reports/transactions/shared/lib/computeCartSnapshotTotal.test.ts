import { describe, expect, it } from "vitest";
import { computeCartSnapshotTotal } from "./computeCartSnapshotTotal";

describe("computeCartSnapshotTotal", () => {
  it("returns 0 for invalid snapshot", () => {
    expect(computeCartSnapshotTotal(null)).toBe(0);
    expect(computeCartSnapshotTotal({})).toBe(0);
  });

  it("sums line totals with modifiers and line discount", () => {
    const total = computeCartSnapshotTotal([
      {
        id: "1",
        kind: "product",
        serviceName: "Milk Tea",
        quantity: 2,
        unitPrice: 25000,
        modifiers: [{ optionId: "m1", name: "Pearl", extraPrice: 5000 }],
        lineDiscount: { id: "d1", name: "Promo", amountRp: 3000 },
      },
      {
        id: "2",
        kind: "product",
        serviceName: "Coffee",
        quantity: 1,
        unitPrice: 18000,
      },
    ]);
    // line1: (25000*2 + 5000*2) - 3000 = 57000; line2: 18000
    expect(total).toBe(75000);
  });
});
