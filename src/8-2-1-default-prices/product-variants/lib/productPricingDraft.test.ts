import { describe, expect, it } from "vitest";
import {
  displaySku,
  masterUnitPriceFromVariants,
  persistableSalesTypePrices,
  persistableVariants,
} from "./productPricingDraft";

describe("persistableVariants", () => {
  it("drops unnamed rows and parses prices", () => {
    expect(
      persistableVariants([
        { id: "v1", name: " Large ", sku: " L ", priceDisplay: "18.000" },
        { id: "v2", name: "  ", sku: "x", priceDisplay: "1" },
      ]),
    ).toEqual([{ id: "v1", name: "Large", sku: "L", price: 18000, sort_order: 1 }]);
  });
});

describe("masterUnitPriceFromVariants", () => {
  it("uses the first variant price", () => {
    expect(masterUnitPriceFromVariants([], 9)).toBe(9);
    expect(
      masterUnitPriceFromVariants([{ id: "v1", name: "A", sku: null, price: 12, sort_order: 1 }], 9),
    ).toBe(12);
  });
});

describe("persistableSalesTypePrices", () => {
  it("stores product-level prices when there are no variants", () => {
    expect(
      persistableSalesTypePrices({
        useSalesTypePrices: true,
        variants: [],
        productDisplays: { st1: "15000" },
        variantDisplays: {},
      }),
    ).toEqual([{ variant_id: null, sales_type_id: "st1", price: 15000 }]);
  });

  it("returns empty when the checkbox is off", () => {
    expect(
      persistableSalesTypePrices({
        useSalesTypePrices: false,
        variants: [],
        productDisplays: { st1: "1" },
        variantDisplays: {},
      }),
    ).toEqual([]);
  });
});

describe("displaySku", () => {
  it("prefers catalog sku then inventory sku", () => {
    expect(displaySku({ catalogSku: "A", variants: [], inventorySkuCode: "B" })).toBe("A");
    expect(displaySku({ catalogSku: "", variants: [], inventorySkuCode: "B" })).toBe("B");
  });
});
