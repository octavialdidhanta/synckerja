import { describe, expect, it } from "vitest";
import { buildCustomizeCartLine } from "./buildCustomizeCartLine";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

const item: CustomerVisitCatalogItem = {
  id: "p1",
  kind: "product",
  serviceId: null,
  subServiceId: null,
  serviceName: "Nasi Telur",
  subServiceName: "porsi",
  unitPrice: 15000,
  photoUrl: null,
  unit: "porsi",
  trackStock: false,
  inventorySkuId: null,
  availableQty: null,
  productCategoryId: null,
  productCategoryName: null,
  posStatus: "available",
};

describe("buildCustomizeCartLine kitchenNote", () => {
  it("sanitizes and fingerprints kitchen notes", () => {
    const line = buildCustomizeCartLine({
      item,
      quantity: 1,
      variantId: null,
      variantName: null,
      baseUnitPrice: 15000,
      modifiers: [],
      lineDiscount: null,
      lineSalesTypeId: null,
      lineSalesTypeLabel: null,
      kitchenNote: "  kurang   pedas  ",
    });
    expect(line.kitchenNote).toBe("kurang pedas");
    expect(line.lineKey).toContain("kurang pedas");
    expect(line.lineKey).not.toBe("plain:p1");
  });

  it("omits empty notes from fingerprint (plain line)", () => {
    const line = buildCustomizeCartLine({
      item,
      quantity: 2,
      variantId: null,
      variantName: null,
      baseUnitPrice: 15000,
      modifiers: [],
      lineDiscount: null,
      lineSalesTypeId: null,
      lineSalesTypeLabel: null,
      kitchenNote: "   ",
    });
    expect(line.kitchenNote).toBeNull();
    expect(line.lineKey).toBe("plain:p1");
  });
});
