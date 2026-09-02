import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  bumpLastLineForCatalogId,
  mergeCustomizedCartLine,
  removeLastLineForCatalogId,
  replaceCartLine,
} from "./orderCartLines";

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

describe("mergeCustomizedCartLine", () => {
  it("merges identical fingerprints and keeps different configs separate", () => {
    const a = line({ lineKey: "p1|v1|o1||", variantId: "v1", quantity: 1 });
    const same = line({ lineKey: "p1|v1|o1||", variantId: "v1", quantity: 2 });
    const other = line({ lineKey: "p1|v1|o2||", variantId: "v1", quantity: 1 });
    const merged = mergeCustomizedCartLine([a], same);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(3);
    expect(mergeCustomizedCartLine(merged, other)).toHaveLength(2);
  });
});

describe("replaceCartLine", () => {
  it("keeps qty when the fingerprint stays the same", () => {
    const existing = line({
      lineKey: "p1|v1|o1||",
      variantId: "v1",
      quantity: 3,
      kitchenNote: "a",
    });
    const next = line({
      lineKey: "p1|v1|o1||",
      variantId: "v1",
      quantity: 1,
      kitchenNote: "b",
    });
    const replaced = replaceCartLine([existing], existing.lineKey, next);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.quantity).toBe(3);
    expect(replaced[0]?.kitchenNote).toBe("b");
  });

  it("drops the old line and inserts the new fingerprint with the same qty", () => {
    const existing = line({ lineKey: "p1|v1|o1||", variantId: "v1", quantity: 2 });
    const next = line({ lineKey: "p1|v1|o2||", variantId: "v1", quantity: 9 });
    const replaced = replaceCartLine([existing], existing.lineKey, next);
    expect(replaced.map((l) => `${l.lineKey}:${l.quantity}`)).toEqual(["p1|v1|o2||:2"]);
  });

  it("merges into an existing line when the new fingerprint already exists", () => {
    const a = line({ lineKey: "p1|v1|o1||", variantId: "v1", quantity: 2 });
    const b = line({ lineKey: "p1|v1|o2||", variantId: "v1", quantity: 1 });
    const next = line({ lineKey: "p1|v1|o2||", variantId: "v1", quantity: 1 });
    const replaced = replaceCartLine([a, b], a.lineKey, next);
    expect(replaced.map((l) => `${l.lineKey}:${l.quantity}`)).toEqual(["p1|v1|o2||:3"]);
  });
});

describe("bumpLastLineForCatalogId", () => {
  it("increments the last matching catalog line", () => {
    const first = line({ lineKey: "a", catalogId: "p1", quantity: 1 });
    const second = line({ lineKey: "b", catalogId: "p1", quantity: 2 });
    const other = line({ lineKey: "c", catalogId: "p2", quantity: 1 });
    expect(
      bumpLastLineForCatalogId([first, other, second], "p1").map((l) => `${l.lineKey}:${l.quantity}`),
    ).toEqual(["a:1", "c:1", "b:3"]);
  });
});

describe("removeLastLineForCatalogId", () => {
  it("decrements the last matching catalog line", () => {
    const first = line({ lineKey: "a", catalogId: "p1", quantity: 1 });
    const second = line({ lineKey: "b", catalogId: "p1", quantity: 2 });
    const other = line({ lineKey: "c", catalogId: "p2", quantity: 1 });
    const next = removeLastLineForCatalogId([first, other, second], "p1");
    expect(next.map((l) => `${l.lineKey}:${l.quantity}`)).toEqual(["a:1", "c:1", "b:1"]);
    expect(removeLastLineForCatalogId(next, "p1").map((l) => l.lineKey)).toEqual(["a", "c"]);
  });
});
