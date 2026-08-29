import { describe, expect, it } from "vitest";
import { findInsufficientRecipeStock } from "./assertRecipeCheckoutStock";
import { productSalesStockMode } from "./productSalesStockMode";

describe("productSalesStockMode", () => {
  it("classifies retail, menu recipe, and none", () => {
    expect(productSalesStockMode({ kind: "product", trackStock: true })).toBe("retailTracked");
    expect(
      productSalesStockMode({ kind: "product", trackStock: false, hasBaseRecipe: true }),
    ).toBe("recipeMenu");
    expect(
      productSalesStockMode({ kind: "product", trackStock: false, hasBaseRecipe: false }),
    ).toBe("none");
    expect(productSalesStockMode({ kind: "service", trackStock: false })).toBe("none");
  });
});

describe("findInsufficientRecipeStock", () => {
  it("returns null when stock covers demand", () => {
    expect(
      findInsufficientRecipeStock({
        lines: [{ kind: "product", catalogId: "p1", quantity: 2, label: "Nasi" }],
        recipeLines: [
          { productId: "p1", ingredientId: "flour", quantityPerUnit: 100, ingredientName: "Flour" },
        ],
        stockByIngredientId: new Map([["flour", 250]]),
      }),
    ).toBeNull();
  });

  it("flags shortfall across shared ingredients", () => {
    const result = findInsufficientRecipeStock({
      lines: [
        { kind: "product", catalogId: "p1", quantity: 2, label: "A" },
        { kind: "product", catalogId: "p2", quantity: 1, label: "B" },
      ],
      recipeLines: [
        { productId: "p1", ingredientId: "flour", quantityPerUnit: 100, ingredientName: "Flour" },
        { productId: "p2", ingredientId: "flour", quantityPerUnit: 50, ingredientName: "Flour" },
      ],
      stockByIngredientId: new Map([["flour", 200]]),
    });
    expect(result).toMatchObject({
      ingredientId: "flour",
      needed: 250,
      available: 200,
    });
  });

  it("ignores products without recipes", () => {
    expect(
      findInsufficientRecipeStock({
        lines: [{ kind: "product", catalogId: "p9", quantity: 5 }],
        recipeLines: [],
        stockByIngredientId: new Map(),
      }),
    ).toBeNull();
  });
});
