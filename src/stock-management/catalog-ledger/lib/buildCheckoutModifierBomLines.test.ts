import { describe, expect, it } from "vitest";
import { findInsufficientCheckoutIngredientStock } from "./assertCheckoutIngredientDemand";
import {
  buildCheckoutModifierBomLines,
  buildFallbackModifierBomLines,
  buildSheetModifierBomLines,
} from "./buildCheckoutModifierBomLines";

describe("buildSheetModifierBomLines", () => {
  it("tracks sheet BOM option ids without productId on lines", () => {
    const result = buildSheetModifierBomLines([
      { optionId: "opt-a", ingredientId: "milk", quantityPerUnit: 50 },
    ]);
    expect(result.sheetBomOptionIds).toEqual(new Set(["opt-a"]));
    expect(result.optionBomLines).toEqual([
      {
        optionId: "opt-a",
        ingredientId: "milk",
        quantityPerUnit: 50,
        stockEnabled: true,
      },
    ]);
  });
});

describe("buildFallbackModifierBomLines", () => {
  it("loads fallback for every product when no sheet BOM", () => {
    const lines = buildFallbackModifierBomLines(
      [
        {
          productId: "latte",
          optionId: "opt-shot",
          lines: [{ ingredientId: "espresso", quantityPerUnit: 30 }],
        },
        {
          productId: "tea",
          optionId: "opt-shot",
          lines: [{ ingredientId: "espresso", quantityPerUnit: 10 }],
        },
      ],
      new Set(),
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((row) => row.productId).sort()).toEqual(["latte", "tea"]);
  });

  it("skips fallback when option has sheet BOM", () => {
    const lines = buildFallbackModifierBomLines(
      [
        {
          productId: "latte",
          optionId: "opt-shot",
          lines: [{ ingredientId: "espresso", quantityPerUnit: 30 }],
        },
      ],
      new Set(["opt-shot"]),
    );
    expect(lines).toEqual([]);
  });
});

describe("buildCheckoutModifierBomLines", () => {
  it("sheet BOM wins over fallback recipes for the same option", () => {
    const result = buildCheckoutModifierBomLines({
      sheetBoms: [{ optionId: "opt-pearl", ingredientId: "pearl", quantityPerUnit: 20 }],
      fallbackRecipes: [
        {
          productId: "latte",
          optionId: "opt-pearl",
          lines: [{ ingredientId: "pearl", quantityPerUnit: 99 }],
        },
      ],
    });
    expect(result.optionBomLines).toEqual([
      {
        optionId: "opt-pearl",
        ingredientId: "pearl",
        quantityPerUnit: 20,
        stockEnabled: true,
      },
    ]);
  });

  it("end-to-end: multi-product fallback demand blocks when stock insufficient", () => {
    const { optionBomLines } = buildCheckoutModifierBomLines({
      sheetBoms: [],
      fallbackRecipes: [
        {
          productId: "latte",
          optionId: "opt-shot",
          lines: [{ ingredientId: "espresso", quantityPerUnit: 30 }],
        },
        {
          productId: "tea",
          optionId: "opt-shot",
          lines: [{ ingredientId: "espresso", quantityPerUnit: 10 }],
        },
      ],
    });

    const shortfall = findInsufficientCheckoutIngredientStock({
      lines: [
        {
          kind: "product",
          catalogId: "latte",
          quantity: 1,
          modifiers: [{ optionId: "opt-shot" }],
        },
        {
          kind: "product",
          catalogId: "tea",
          quantity: 1,
          modifiers: [{ optionId: "opt-shot" }],
        },
      ],
      recipeLines: [],
      optionBomLines: optionBomLines.map((row) => ({
        ...row,
        ingredientName: "Espresso",
      })),
      stockByIngredientId: new Map([["espresso", 35]]),
    });

    expect(shortfall).toMatchObject({ ingredientId: "espresso", ingredientName: "Espresso" });
  });
});
