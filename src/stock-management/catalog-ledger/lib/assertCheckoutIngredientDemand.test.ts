import { describe, expect, it } from "vitest";
import { findInsufficientCheckoutIngredientStock } from "./assertCheckoutIngredientDemand";

describe("findInsufficientCheckoutIngredientStock", () => {
  it("merges base recipe and modifier demand before comparing stock", () => {
    const result = findInsufficientCheckoutIngredientStock({
      lines: [
        {
          kind: "product",
          catalogId: "p1",
          quantity: 2,
          modifiers: [{ optionId: "opt-a" }],
        },
      ],
      recipeLines: [
        {
          productId: "p1",
          ingredientId: "flour",
          quantityPerUnit: 50,
          ingredientName: "Flour",
        },
      ],
      optionBomLines: [
        {
          optionId: "opt-a",
          ingredientId: "flour",
          quantityPerUnit: 30,
          ingredientName: "Flour",
          stockEnabled: true,
        },
      ],
      stockByIngredientId: new Map([["flour", 120]]),
    });
    expect(result).toMatchObject({ ingredientId: "flour", ingredientName: "Flour" });
  });

  it("returns null when merged demand fits stock", () => {
    expect(
      findInsufficientCheckoutIngredientStock({
        lines: [
          {
            kind: "product",
            catalogId: "p1",
            quantity: 1,
            modifiers: [{ optionId: "opt-a" }],
          },
        ],
        recipeLines: [
          {
            productId: "p1",
            ingredientId: "flour",
            quantityPerUnit: 50,
            ingredientName: "Flour",
          },
        ],
        optionBomLines: [
          {
            optionId: "opt-a",
            ingredientId: "flour",
            quantityPerUnit: 30,
            ingredientName: "Flour",
            stockEnabled: true,
          },
        ],
        stockByIngredientId: new Map([["flour", 100]]),
      }),
    ).toBeNull();
  });
});
