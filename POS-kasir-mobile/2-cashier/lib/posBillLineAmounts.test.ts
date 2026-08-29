import { describe, expect, it } from "vitest";
import { posBillLineBaseUnitPrice } from "./posBillLineAmounts";

describe("posBillLineBaseUnitPrice", () => {
  it("shows the variant base after stripping extras and discount", () => {
    expect(
      posBillLineBaseUnitPrice({
        unitPrice: 30400,
        quantity: 1,
        modifiers: [
          { optionId: "a", name: "keju", extraPrice: 5000 },
          { optionId: "b", name: "coklat", extraPrice: 5000 },
        ],
        lineDiscount: { id: "d", name: "Discount Karyawan", amountRp: 7600 },
      }),
    ).toBe(28000);
  });

  it("equals unitPrice when there are no extras or discount", () => {
    expect(
      posBillLineBaseUnitPrice({
        unitPrice: 25000,
        quantity: 2,
        modifiers: [],
        lineDiscount: null,
      }),
    ).toBe(25000);
  });
});
