import { describe, expect, it } from "vitest";
import { isRecipeComplete, isRecipeDraftComplete, persistableRecipeLines } from "./recipeCompleteness";

describe("isRecipeComplete", () => {
  it("requires a positive yield and at least one positive line qty", () => {
    expect(isRecipeComplete(0, [{ ingredient_id: "a", quantity: 1 }])).toBe(false);
    expect(isRecipeComplete(10, [])).toBe(false);
    expect(isRecipeComplete(10, [{ ingredient_id: "a", quantity: 0 }])).toBe(false);
    expect(isRecipeComplete(10, [{ ingredient_id: "a", quantity: 2 }])).toBe(true);
  });
});

describe("isRecipeDraftComplete", () => {
  it("treats missing drafts as incomplete", () => {
    expect(isRecipeDraftComplete(null)).toBe(false);
    expect(isRecipeDraftComplete({ yieldQty: 5, lines: [{ ingredient_id: "a", quantity: 1 }] })).toBe(true);
  });
});

describe("persistableRecipeLines", () => {
  it("drops zero-quantity lines", () => {
    expect(
      persistableRecipeLines([
        { ingredient_id: "a", quantity: 0 },
        { ingredient_id: "b", quantity: 1.5 },
      ]),
    ).toEqual([{ ingredient_id: "b", quantity: 1.5 }]);
  });
});
