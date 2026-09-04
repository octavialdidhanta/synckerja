import { describe, expect, it } from "vitest";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { findCatalogItemByScanCode } from "./findCatalogItemByScanCode";

function item(partial: Partial<CustomerVisitCatalogItem> & { id: string }): CustomerVisitCatalogItem {
  return {
    kind: "product",
    serviceId: null,
    subServiceId: null,
    serviceName: "Item",
    subServiceName: null,
    unitPrice: 1000,
    photoUrl: null,
    unit: "pcs",
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    productCategoryId: null,
    productCategoryName: null,
    posStatus: "available",
    catalogSku: null,
    ...partial,
  };
}

describe("findCatalogItemByScanCode", () => {
  const items = [
    item({ id: "1", catalogSku: "ABC-01", serviceName: "Kopi" }),
    item({ id: "2", catalogSku: "xyz", serviceName: "Teh" }),
    item({ id: "3", catalogSku: null, serviceName: "NoSku" }),
  ];

  it("matches case-insensitively", () => {
    expect(findCatalogItemByScanCode(items, "abc-01")?.id).toBe("1");
    expect(findCatalogItemByScanCode(items, "XYZ")?.serviceName).toBe("Teh");
  });

  it("returns null when missing", () => {
    expect(findCatalogItemByScanCode(items, "nope")).toBeNull();
    expect(findCatalogItemByScanCode(items, "")).toBeNull();
  });
});
