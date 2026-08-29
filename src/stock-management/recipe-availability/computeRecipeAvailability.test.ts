import { describe, expect, it } from "vitest";
import {
  analyzeRecipeServings,
  buildRecipeOutOfStockProductIds,
  formatRecipeBlockerNames,
} from "@/stock-management/recipe-availability";

describe("analyzeRecipeServings / buildRecipeOutOfStockProductIds", () => {
  it("marks product out and lists Beras as blocker when stock is 0", () => {
    const stock = new Map([
      ["beras", 0],
      ["telor", 40],
    ]);
    const lines = [
      {
        productId: "nasi-telur",
        ingredientId: "beras",
        quantityPerUnit: 1,
        trackInventory: true,
        ingredientName: "Beras",
      },
      {
        productId: "nasi-telur",
        ingredientId: "telor",
        quantityPerUnit: 1,
        trackInventory: true,
        ingredientName: "Telor",
      },
    ];
    const avail = analyzeRecipeServings("nasi-telur", lines, stock);
    expect(avail.maxServings).toBe(0);
    expect(avail.blockers.map((b) => b.ingredientName)).toEqual(["Beras"]);
    expect(buildRecipeOutOfStockProductIds(lines, stock).has("nasi-telur")).toBe(true);
  });

  it("lists all blockers when multiple ingredients are short", () => {
    const stock = new Map([
      ["beras", 0],
      ["telor", 0],
    ]);
    const avail = analyzeRecipeServings(
      "nasi-telur",
      [
        {
          productId: "nasi-telur",
          ingredientId: "beras",
          quantityPerUnit: 1,
          trackInventory: true,
          ingredientName: "Beras",
        },
        {
          productId: "nasi-telur",
          ingredientId: "telor",
          quantityPerUnit: 1,
          trackInventory: true,
          ingredientName: "Telor",
        },
      ],
      stock,
    );
    expect(avail.blockers.map((b) => b.ingredientName).sort()).toEqual(["Beras", "Telor"]);
    const labels = formatRecipeBlockerNames(avail.blockers);
    expect(labels.full).toContain("Beras");
    expect(labels.full).toContain("Telor");
  });

  it("ignores untracked ingredients", () => {
    const stock = new Map<string, number>();
    const out = buildRecipeOutOfStockProductIds(
      [
        {
          productId: "nasi-telur",
          ingredientId: "bumbu",
          quantityPerUnit: 1,
          trackInventory: false,
        },
      ],
      stock,
    );
    expect(out.size).toBe(0);
  });

  it("keeps product available when stock covers recipe", () => {
    const stock = new Map([
      ["nasi", 5],
      ["telor", 5],
    ]);
    const out = buildRecipeOutOfStockProductIds(
      [
        {
          productId: "nasi-telur",
          ingredientId: "nasi",
          quantityPerUnit: 1,
          trackInventory: true,
          ingredientName: "Nasi",
        },
        {
          productId: "nasi-telur",
          ingredientId: "telor",
          quantityPerUnit: 1,
          trackInventory: true,
          ingredientName: "Telor",
        },
      ],
      stock,
    );
    expect(out.has("nasi-telur")).toBe(false);
  });
});
