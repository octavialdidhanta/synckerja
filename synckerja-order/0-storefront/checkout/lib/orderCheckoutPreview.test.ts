import { describe, expect, it } from "vitest";
import { emptyOrderCheckoutPreview, otherFeeLines, otherFeesTotal } from "./orderCheckoutPreview";

describe("orderCheckoutPreview helpers", () => {
  it("starts with cart subtotal and no fees", () => {
    expect(emptyOrderCheckoutPreview(12500)).toEqual({
      ok: true,
      subtotal: 12500,
      taxLines: [],
      gratuityLines: [],
      taxTotal: 0,
      gratuityTotal: 0,
      grandTotal: 12500,
    });
  });

  it("lists named tax and gratuity rows as other fees", () => {
    const preview = {
      ...emptyOrderCheckoutPreview(10000),
      taxLines: [{ name: "PB1", amount: 1000, amount_percent: 10 }],
      gratuityLines: [{ name: "Service", amount: 500, amount_percent: 5 }],
      taxTotal: 1000,
      gratuityTotal: 500,
      grandTotal: 11500,
    };
    expect(otherFeeLines(preview).map((line) => line.name)).toEqual(["PB1", "Service"]);
    expect(otherFeesTotal(preview)).toBe(1500);
  });
});
