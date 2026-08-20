import { describe, expect, it } from "vitest";
import type { CatalogIngredient } from "../../library/types";
import type { CatalogProductRecipe } from "../types";
import { buildProductRecipeListRows, recipeStockAlert, recipeVariantLabel } from "./productRecipeListRows";

const ingredient: CatalogIngredient = {
  id: "i1",
  organization_id: "org",
  name: "Egg",
  kind: "raw",
  category_id: null,
  unit_code: "pcs",
  track_inventory: true,
  sort_order: 1,
  photo_path: null,
  photo_url: null,
  outlet_ids: ["o1"],
  outlet_stocks: [
    {
      outlet_id: "o1",
      in_stock: 0,
      alert_enabled: true,
      alert_at: 5,
      track_cogs: true,
      avg_cost: 3500,
    },
  ],
};

describe("recipeVariantLabel", () => {
  it("formats linked modifier options", () => {
    expect(
      recipeVariantLabel("opt1", [{ id: "opt1", group_id: "g1", group_name: "Size", name: "Large" }]),
    ).toBe("Size: Large");
  });

  it("returns empty for base recipes", () => {
    expect(recipeVariantLabel(null, [])).toBe("");
  });
});

describe("recipeStockAlert", () => {
  it("returns out when any ingredient is out of stock", () => {
    const recipe: CatalogProductRecipe = {
      id: "r1",
      organization_id: "org",
      product_id: "p1",
      modifier_option_id: null,
      lines: [{ ingredient_id: "i1", quantity: 1, sort_order: 1 }],
    };
    const map = new Map([["i1", ingredient]]);
    expect(recipeStockAlert(recipe, map, "o1")).toBe("out");
  });
});

describe("buildProductRecipeListRows", () => {
  it("includes only recipes for products on the outlet", () => {
    const recipes: CatalogProductRecipe[] = [
      {
        id: "r1",
        organization_id: "org",
        product_id: "p1",
        modifier_option_id: null,
        lines: [{ ingredient_id: "i1", quantity: 1, sort_order: 1 }],
      },
    ];
    const rows = buildProductRecipeListRows({
      recipes,
      products: [
        { id: "p1", name: "Ayam Geprek", product_category_id: null, photo_url: null, outlet_ids: ["o1"] },
      ],
      modifierOptions: [],
      ingredients: [ingredient],
      outletId: "o1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe("Ayam Geprek");
    expect(rows[0].lineCount).toBe(1);
    expect(rows[0].stockAlert).toBe("out");
  });
});
