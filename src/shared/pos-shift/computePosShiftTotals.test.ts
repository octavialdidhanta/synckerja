import { describe, expect, it } from "vitest";
import { computePosShiftTotals } from "@/shared/pos-shift";

describe("computePosShiftTotals", () => {
  it("computes expected cash with refunds and movements", () => {
    const totals = computePosShiftTotals({
      openingCash: 200_000,
      cashSales: 306_800,
      cashRefunds: 10_000,
      productsSoldQty: 5,
      movements: [
        {
          id: "1",
          organization_id: "org",
          shift_id: "shift",
          direction: "in",
          amount: 5_000,
          description: "pay in",
          created_by: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "2",
          organization_id: "org",
          shift_id: "shift",
          direction: "out",
          amount: 3_000,
          description: "pay out",
          created_by: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(totals.expectedCash).toBe(200_000 + 306_800 - 10_000 + 5_000 - 3_000);
    expect(totals.cashInOutNet).toBe(2_000);
    expect(totals.productsSoldQty).toBe(5);
  });
});
