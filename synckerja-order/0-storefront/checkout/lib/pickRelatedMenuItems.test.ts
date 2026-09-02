import { describe, expect, it } from "vitest";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { pairingsFromCategories, pickRelatedMenuItems } from "./pickRelatedMenuItems";

function item(patch: Partial<PublicOrderCatalogItem> & Pick<PublicOrderCatalogItem, "id" | "name">): PublicOrderCatalogItem {
  return {
    description: null,
    unit_price: 10000,
    photo_path: null,
    product_category_id: "drinks",
    product_category_name: "Drinks",
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

describe("pairingsFromCategories", () => {
  it("keeps only categories with a related target", () => {
    expect(
      pairingsFromCategories([
        { id: "food", name: "Food", related_category_id: "drinks" },
        { id: "drinks", name: "Drinks" },
      ]),
    ).toEqual([{ fromCategoryId: "food", toCategoryId: "drinks" }]);
  });
});

describe("pickRelatedMenuItems", () => {
  const drinks = [
    item({ id: "tea", name: "Tea", product_category_id: "drinks" }),
    item({ id: "coffee", name: "Coffee", product_category_id: "drinks" }),
    item({ id: "hidden", name: "Hidden", product_category_id: "drinks", pos_status: "hidden" }),
  ];
  const pairings = [{ fromCategoryId: "food", toCategoryId: "drinks" }];

  it("suggests paired-category items and excludes the cart", () => {
    const picked = pickRelatedMenuItems({
      lines: [{ catalogId: "mie", productCategoryId: "food" }],
      items: drinks,
      pairings,
    });
    expect(picked.map((row) => row.id)).toEqual(["coffee", "tea"]);
  });

  it("excludes items already in the cart and honors the limit", () => {
    const picked = pickRelatedMenuItems({
      lines: [
        { catalogId: "mie", productCategoryId: "food" },
        { catalogId: "tea", productCategoryId: "drinks" },
      ],
      items: drinks,
      pairings,
      limit: 1,
    });
    expect(picked.map((row) => row.id)).toEqual(["coffee"]);
  });

  it("returns empty when no pairing matches", () => {
    expect(
      pickRelatedMenuItems({
        lines: [{ catalogId: "mie", productCategoryId: "food" }],
        items: drinks,
        pairings: [],
      }),
    ).toEqual([]);
  });
});
