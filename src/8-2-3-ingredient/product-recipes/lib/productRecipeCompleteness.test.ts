import { describe, expect, it } from "vitest";
import {
  isProductRecipeComplete,
  isProductRecipeDraftComplete,
  persistableProductRecipeLines,
} from "./productRecipeCompleteness";

describe("isProductRecipeComplete", () => {
  it("requires at least one positive line qty", () => {
    expect(isProductRecipeComplete([])).toBe(false);
    expect(isProductRecipeComplete([{ ingredient_id: "a", quantity: 0 }])).toBe(false);
    expect(isProductRecipeComplete([{ ingredient_id: "a", quantity: 1.5 }])).toBe(true);
  });
});

describe("isProductRecipeDraftComplete", () => {
  it("treats missing drafts as incomplete", () => {
    expect(isProductRecipeDraftComplete(null)).toBe(false);
    expect(
      isProductRecipeDraftComplete({ lines: [{ ingredient_id: "a", quantity: 2 }] }),
    ).toBe(true);
  });
});

describe("persistableProductRecipeLines", () => {
  it("drops zero-quantity lines", () => {
    expect(
      persistableProductRecipeLines([
        { ingredient_id: "a", quantity: 0 },
        { ingredient_id: "b", quantity: 3 },
      ]),
    ).toEqual([{ ingredient_id: "b", quantity: 3 }]);
  });
});
