import { describe, expect, it } from "vitest";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { needsOrderItemCustomize } from "./needsOrderItemCustomize";

function item(patch: Partial<PublicOrderCatalogItem>): PublicOrderCatalogItem {
  return {
    id: "p1",
    name: "Item",
    description: null,
    unit_price: 10000,
    photo_path: null,
    product_category_id: null,
    product_category_name: null,
    pos_status: "available",
    kind: "product",
    service_id: null,
    sub_service_id: null,
    track_stock: false,
    inventory_sku_id: null,
    available_qty: null,
    variants: [],
    ...patch,
  };
}

describe("needsOrderItemCustomize", () => {
  it("skips plain products", () => {
    expect(needsOrderItemCustomize(item({}))).toBe(false);
  });

  it("skips a single variant with no modifiers", () => {
    expect(
      needsOrderItemCustomize(
        item({
          variants: [{ id: "v1", name: "Regular", price: 10000 }],
          variant_count: 1,
        }),
      ),
    ).toBe(false);
  });

  it("opens for two or more variants", () => {
    expect(
      needsOrderItemCustomize(
        item({
          variants: [
            { id: "v1", name: "S", price: 10000 },
            { id: "v2", name: "L", price: 12000 },
          ],
          variant_count: 2,
        }),
      ),
    ).toBe(true);
  });

  it("opens when modifiers exist even with one variant", () => {
    expect(
      needsOrderItemCustomize(
        item({
          has_modifiers: true,
          variants: [{ id: "v1", name: "Regular", price: 10000 }],
          variant_count: 1,
        }),
      ),
    ).toBe(true);
  });

  it("opens for published bundles", () => {
    expect(needsOrderItemCustomize(item({ kind: "bundle" }))).toBe(true);
  });
});
