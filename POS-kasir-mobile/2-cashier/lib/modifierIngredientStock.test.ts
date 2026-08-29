import { describe, expect, it } from "vitest";
import {
  isModifierOptionOutOfStock,
  maxServingsFromModifierRecipe,
} from "./modifierIngredientStock";

describe("maxServingsFromModifierRecipe", () => {
  it("returns null when there is no recipe", () => {
    expect(maxServingsFromModifierRecipe([], new Map())).toBeNull();
  });

  it("returns floor of bottleneck ingredient", () => {
    const stock = new Map([
      ["a", 10],
      ["b", 3],
    ]);
    expect(
      maxServingsFromModifierRecipe(
        [
          { ingredientId: "a", quantityPerOption: 2 },
          { ingredientId: "b", quantityPerOption: 1 },
        ],
        stock,
      ),
    ).toBe(3);
  });

  it("returns 0 when any ingredient is missing or empty", () => {
    expect(
      maxServingsFromModifierRecipe(
        [{ ingredientId: "a", quantityPerOption: 1 }],
        new Map([["a", 0]]),
      ),
    ).toBe(0);
    expect(
      maxServingsFromModifierRecipe(
        [{ ingredientId: "a", quantityPerOption: 1 }],
        new Map(),
      ),
    ).toBe(0);
  });
});

describe("isModifierOptionOutOfStock", () => {
  it("gates only when qty is known and <= 0", () => {
    expect(isModifierOptionOutOfStock(null)).toBe(false);
    expect(isModifierOptionOutOfStock(undefined)).toBe(false);
    expect(isModifierOptionOutOfStock(2)).toBe(false);
    expect(isModifierOptionOutOfStock(0)).toBe(true);
  });
});
