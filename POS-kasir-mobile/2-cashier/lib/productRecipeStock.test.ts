import { describe, expect, it } from "vitest";
import { buildRecipeOutOfStockProductIds } from "./productRecipeStock";

describe("buildRecipeOutOfStockProductIds", () => {
  it("marks product out when a tracked ingredient cannot cover 1 serving", () => {
    const stock = new Map([
      ["nasi", 0],
      ["telor", 10],
    ]);
    const out = buildRecipeOutOfStockProductIds(
      [
        { productId: "nasi-telur", ingredientId: "nasi", quantityPerUnit: 1, trackInventory: true },
        { productId: "nasi-telur", ingredientId: "telor", quantityPerUnit: 1, trackInventory: true },
      ],
      stock,
    );
    expect(out.has("nasi-telur")).toBe(true);
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
        { productId: "nasi-telur", ingredientId: "nasi", quantityPerUnit: 1, trackInventory: true },
        { productId: "nasi-telur", ingredientId: "telor", quantityPerUnit: 1, trackInventory: true },
      ],
      stock,
    );
    expect(out.has("nasi-telur")).toBe(false);
  });
});
