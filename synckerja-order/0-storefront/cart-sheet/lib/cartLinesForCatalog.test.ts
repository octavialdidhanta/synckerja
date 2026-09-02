import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLinesForCatalog } from "./cartLinesForCatalog";

function line(patch: Partial<CustomerVisitCartLine>): CustomerVisitCartLine {
  return {
    lineKey: "plain:p1",
    catalogId: "p1",
    kind: "product",
    serviceId: null,
    subServiceId: null,
    serviceName: "Item",
    subServiceName: null,
    quantity: 1,
    unitPrice: 10000,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...patch,
  };
}

describe("cartLinesForCatalog", () => {
  it("filters by catalogId and lists last-in first", () => {
    const first = line({ lineKey: "a", catalogId: "p1" });
    const other = line({ lineKey: "c", catalogId: "p2" });
    const second = line({ lineKey: "b", catalogId: "p1" });
    expect(cartLinesForCatalog([first, other, second], "p1").map((l) => l.lineKey)).toEqual([
      "b",
      "a",
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(cartLinesForCatalog([line({ catalogId: "p1" })], "p9")).toEqual([]);
  });
});
