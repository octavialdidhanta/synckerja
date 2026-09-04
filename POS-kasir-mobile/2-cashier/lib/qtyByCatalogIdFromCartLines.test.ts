import { describe, expect, it } from "vitest";
import { qtyByCatalogIdFromCartLines } from "./qtyByCatalogIdFromCartLines";

describe("qtyByCatalogIdFromCartLines", () => {
  it("sums quantities for the same catalogId", () => {
    const map = qtyByCatalogIdFromCartLines([
      { catalogId: "a", quantity: 2 },
      { catalogId: "a", quantity: 1 },
      { catalogId: "b", quantity: 3 },
    ]);
    expect(map.get("a")).toBe(3);
    expect(map.get("b")).toBe(3);
    expect(map.has("c")).toBe(false);
  });

  it("ignores empty ids and non-positive qty", () => {
    const map = qtyByCatalogIdFromCartLines([
      { catalogId: "  ", quantity: 2 },
      { catalogId: "a", quantity: 0 },
      { catalogId: "b", quantity: -1 },
    ]);
    expect(map.size).toBe(0);
  });

  it("accepts snake_case catalog_id from session snapshots", () => {
    const map = qtyByCatalogIdFromCartLines([
      { catalog_id: "extra", quantity: 2 },
      { catalogId: "promo", quantity: 1 },
    ]);
    expect(map.get("extra")).toBe(2);
    expect(map.get("promo")).toBe(1);
  });
});
