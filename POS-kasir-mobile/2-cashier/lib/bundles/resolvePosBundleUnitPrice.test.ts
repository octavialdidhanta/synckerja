import { describe, expect, it } from "vitest";
import { resolvePosBundleUnitPrice } from "./resolvePosBundleUnitPrice";
import type { PosOutletBundle } from "./posBundleTypes";

function bundle(overrides: Partial<PosOutletBundle> = {}): PosOutletBundle {
  return {
    id: "b1",
    name: "paket hemat ramadhan",
    photoUrl: null,
    bundlePrice: 50000,
    useSalesTypePrices: false,
    salesTypePrices: [],
    items: [],
    ...overrides,
  };
}

describe("resolvePosBundleUnitPrice", () => {
  it("uses fixed bundle price when sales-type pricing is off", () => {
    expect(resolvePosBundleUnitPrice(bundle(), "dine-in")).toBe(50000);
  });

  it("returns 0 for a missing sales-type price (no min fallback)", () => {
    expect(
      resolvePosBundleUnitPrice(
        bundle({
          useSalesTypePrices: true,
          bundlePrice: 40000,
          salesTypePrices: [{ salesTypeId: "dine-in", price: 55000 }],
        }),
        "takeaway",
      ),
    ).toBe(0);
  });

  it("resolves the matching sales-type price", () => {
    expect(
      resolvePosBundleUnitPrice(
        bundle({
          useSalesTypePrices: true,
          bundlePrice: 40000,
          salesTypePrices: [
            { salesTypeId: "dine-in", price: 55000 },
            { salesTypeId: "takeaway", price: 50000 },
          ],
        }),
        "takeaway",
      ),
    ).toBe(50000);
  });
});
