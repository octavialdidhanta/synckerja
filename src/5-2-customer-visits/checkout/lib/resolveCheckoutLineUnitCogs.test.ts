import { describe, expect, it } from "vitest";
import {
  resolveCheckoutLineUnitCogs,
  type CheckoutCogsContext,
} from "./resolveCheckoutLineUnitCogs";

function emptyCtx(partial?: Partial<CheckoutCogsContext>): CheckoutCogsContext {
  return {
    productStockById: new Map(),
    variantStockById: new Map(),
    ingredientStockById: new Map(),
    recipeLines: [],
    modifierBomLines: [],
    ...partial,
  };
}

describe("resolveCheckoutLineUnitCogs", () => {
  it("uses finished-goods product avg_cost when track_cogs", () => {
    const ctx = emptyCtx({
      productStockById: new Map([["p1", { track_cogs: true, avg_cost: 1500 }]]),
    });
    expect(resolveCheckoutLineUnitCogs({ productId: "p1", ctx })).toEqual({
      unitCogs: 1500,
      cogsSource: "finished_goods",
    });
  });

  it("prefers variant finished-goods over product", () => {
    const ctx = emptyCtx({
      productStockById: new Map([["p1", { track_cogs: true, avg_cost: 1500 }]]),
      variantStockById: new Map([["v1", { track_cogs: true, avg_cost: 2000 }]]),
    });
    expect(
      resolveCheckoutLineUnitCogs({ productId: "p1", variantId: "v1", ctx }),
    ).toEqual({ unitCogs: 2000, cogsSource: "finished_goods" });
  });

  it("falls back to recipe BOM when finished goods not tracked", () => {
    const ctx = emptyCtx({
      productStockById: new Map([["p1", { track_cogs: false, avg_cost: 0 }]]),
      ingredientStockById: new Map([["i1", { track_cogs: true, avg_cost: 100 }]]),
      recipeLines: [
        {
          product_id: "p1",
          modifier_option_id: null,
          ingredient_id: "i1",
          quantity: 2.5,
        },
      ],
    });
    expect(resolveCheckoutLineUnitCogs({ productId: "p1", ctx })).toEqual({
      unitCogs: 250,
      cogsSource: "recipe_bom",
    });
  });

  it("returns none when no cost data", () => {
    expect(resolveCheckoutLineUnitCogs({ productId: "p1", ctx: emptyCtx() })).toEqual({
      unitCogs: null,
      cogsSource: "none",
    });
  });
});
