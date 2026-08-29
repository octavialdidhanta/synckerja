import { describe, expect, it } from "vitest";
import {
  findInsufficientProduceStock,
  produceScaleFactor,
  scaleRecipeLinesForProduce,
} from "./produceRecipeScale";

describe("produceScaleFactor", () => {
  it("returns produce / yield", () => {
    expect(produceScaleFactor(20, 10)).toBe(2);
    expect(produceScaleFactor(5, 10)).toBe(0.5);
  });

  it("returns null for invalid inputs", () => {
    expect(produceScaleFactor(0, 10)).toBeNull();
    expect(produceScaleFactor(10, 0)).toBeNull();
  });
});

describe("scaleRecipeLinesForProduce", () => {
  it("doubles lines when produce is 2x yield", () => {
    expect(
      scaleRecipeLinesForProduce({
        yieldQty: 10,
        produceQty: 20,
        lines: [
          { ingredient_id: "egg", quantity: 1 },
          { ingredient_id: "tapioca", quantity: 60 },
          { ingredient_id: "flour", quantity: 125 },
        ],
      }),
    ).toEqual([
      { ingredientId: "egg", recipeQty: 1, deductQty: 2 },
      { ingredientId: "tapioca", recipeQty: 60, deductQty: 120 },
      { ingredientId: "flour", recipeQty: 125, deductQty: 250 },
    ]);
  });

  it("skips zero-qty lines", () => {
    expect(
      scaleRecipeLinesForProduce({
        yieldQty: 10,
        produceQty: 10,
        lines: [
          { ingredient_id: "egg", quantity: 1 },
          { ingredient_id: "skip", quantity: 0 },
        ],
      }),
    ).toEqual([{ ingredientId: "egg", recipeQty: 1, deductQty: 1 }]);
  });
});

describe("findInsufficientProduceStock", () => {
  it("ignores untracked ingredients", () => {
    expect(
      findInsufficientProduceStock({
        lines: [{ ingredientId: "a", recipeQty: 1, deductQty: 99 }],
        trackInventoryById: new Map([["a", false]]),
        stockById: new Map([["a", 0]]),
      }),
    ).toBeNull();
  });

  it("returns first short tracked line", () => {
    expect(
      findInsufficientProduceStock({
        lines: [
          { ingredientId: "a", recipeQty: 1, deductQty: 2 },
          { ingredientId: "b", recipeQty: 1, deductQty: 5 },
        ],
        trackInventoryById: new Map([
          ["a", true],
          ["b", true],
        ]),
        stockById: new Map([
          ["a", 10],
          ["b", 1],
        ]),
      }),
    ).toEqual({ ingredientId: "b", deductQty: 5, availableQty: 1 });
  });
});
