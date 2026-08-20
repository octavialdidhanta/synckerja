import { describe, expect, it } from "vitest";
import type { CatalogIngredient } from "../../library/types";
import {
  ingredientsForOutlet,
  productsForOutlet,
  variantOptionsForProduct,
} from "./productRecipeTargets";

describe("productsForOutlet", () => {
  it("filters products assigned to the outlet", () => {
    const rows = [
      { id: "p1", name: "Latte", product_category_id: null, photo_url: null, outlet_ids: ["o1"] },
      { id: "p2", name: "Tea", product_category_id: null, photo_url: null, outlet_ids: ["o2"] },
    ];
    expect(productsForOutlet(rows, "o1").map((row) => row.id)).toEqual(["p1"]);
  });
});

describe("ingredientsForOutlet", () => {
  it("includes raw and semi-finished ingredients on the outlet", () => {
    const rows = [
      {
        id: "i1",
        organization_id: "org",
        name: "Milk",
        kind: "raw" as const,
        category_id: null,
        unit_code: "ml",
        track_inventory: false,
        sort_order: 1,
        photo_path: null,
        photo_url: null,
        outlet_ids: ["o1"],
        outlet_stocks: [],
      },
      {
        id: "i2",
        organization_id: "org",
        name: "Sauce",
        kind: "semi_finished" as const,
        category_id: null,
        unit_code: "ml",
        track_inventory: false,
        sort_order: 2,
        photo_path: null,
        photo_url: null,
        outlet_ids: ["o2"],
        outlet_stocks: [],
      },
    ] satisfies CatalogIngredient[];
    expect(ingredientsForOutlet(rows, "o1").map((row) => row.id)).toEqual(["i1"]);
  });
});

describe("variantOptionsForProduct", () => {
  it("returns active options from groups linked to the product", () => {
    const links = [
      { product_id: "p1", group_id: "g1", group_name: "Size" },
      { product_id: "p2", group_id: "g2", group_name: "Flavor" },
    ];
    const options = [
      { id: "o1", group_id: "g1", name: "Large", is_active: true },
      { id: "o2", group_id: "g1", name: "Small", is_active: false },
      { id: "o3", group_id: "g2", name: "Vanilla", is_active: true },
    ];
    expect(variantOptionsForProduct("p1", links, options)).toEqual([
      { id: "o1", group_id: "g1", group_name: "Size", name: "Large" },
    ]);
  });
});
