import { describe, expect, it } from "vitest";
import type { CatalogIngredient } from "../../../library/types";
import { produceBatchCost } from "./produceBatchCost";

function ingredient(
  id: string,
  avgCost: number,
  trackCogs: boolean,
): CatalogIngredient {
  return {
    id,
    organization_id: "org",
    name: id,
    kind: "raw",
    category_id: null,
    unit_code: "g",
    track_inventory: true,
    sort_order: 0,
    photo_path: null,
    photo_url: null,
    outlet_ids: ["o1"],
    outlet_stocks: [
      {
        outlet_id: "o1",
        in_stock: 100,
        alert_enabled: false,
        alert_at: null,
        track_cogs: trackCogs,
        avg_cost: avgCost,
      },
    ],
  };
}

describe("produceBatchCost", () => {
  it("sums tracked COGS lines and computes unit cost", () => {
    const ingredientsById = new Map([
      ["flour", ingredient("flour", 16, true)],
      ["egg", ingredient("egg", 3450, true)],
      ["skip", ingredient("skip", 999, false)],
    ]);
    const result = produceBatchCost({
      outletId: "o1",
      produceQty: 10,
      ingredientsById,
      scaledLines: [
        { ingredientId: "flour", recipeQty: 125, deductQty: 125 },
        { ingredientId: "egg", recipeQty: 1, deductQty: 1 },
        { ingredientId: "skip", recipeQty: 1, deductQty: 1 },
      ],
    });
    expect(result.totalCost).toBe(2000 + 3450);
    expect(result.unitCost).toBe((2000 + 3450) / 10);
  });

  it("returns null unit cost when no cogs lines", () => {
    const ingredientsById = new Map([["a", ingredient("a", 10, false)]]);
    expect(
      produceBatchCost({
        outletId: "o1",
        produceQty: 5,
        ingredientsById,
        scaledLines: [{ ingredientId: "a", recipeQty: 1, deductQty: 1 }],
      }),
    ).toEqual({ totalCost: 0, unitCost: null });
  });
});
