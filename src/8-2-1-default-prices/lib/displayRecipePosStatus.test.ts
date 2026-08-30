import { describe, expect, it } from "vitest";
import type { RecipeAvailability } from "@/stock-management/recipe-availability";
import {
  canStartItemInventoryTracking,
  displayPosStatusForTable,
  displayProductListQty,
  isRecipeDrivenOutOfStock,
  lockItemTrackingCheckbox,
  productListStockModeLabel,
  recipeStockBadge,
} from "./displayRecipePosStatus";

function avail(maxServings: number | null): RecipeAvailability {
  return {
    productId: "p1",
    maxServings,
    blockers: maxServings === 0 ? [{ ingredientId: "n", ingredientName: "Nasi", needed: 1, available: 0 }] : [],
    limiting:
      maxServings === 0
        ? { ingredientId: "n", ingredientName: "Nasi", needed: 1, available: 0 }
        : null,
  };
}

const trackedAvailable = {
  pos_status: "available" as const,
  outlet_overrides: {},
  track_stock: true,
};

describe("displayPosStatusForTable", () => {
  it("shows recipe sold_out even when track_stock is true", () => {
    expect(displayPosStatusForTable(trackedAvailable, null, avail(0), true)).toBe("sold_out");
  });

  it("keeps hidden and explicit sold_out above recipe", () => {
    expect(
      displayPosStatusForTable({ ...trackedAvailable, pos_status: "hidden" }, null, avail(0), true),
    ).toBe("hidden");
    expect(
      displayPosStatusForTable({ ...trackedAvailable, pos_status: "sold_out" }, null, avail(5), true),
    ).toBe("sold_out");
  });

  it("stays available when recipe still has servings", () => {
    expect(displayPosStatusForTable(trackedAvailable, null, avail(4), true)).toBe("available");
  });
});

describe("recipeStockBadge", () => {
  it("shows out/low for hybrid tracked + recipe", () => {
    expect(recipeStockBadge(avail(0), true)).toBe("out");
    expect(recipeStockBadge(avail(2), true)).toBe("low");
    expect(recipeStockBadge(avail(8), true)).toBeNull();
  });

  it("is null without a base recipe", () => {
    expect(recipeStockBadge(avail(0), false)).toBeNull();
  });
});

describe("displayProductListQty", () => {
  it("uses maxServings when product has a base recipe, ignoring finished goods", () => {
    expect(
      displayProductListQty({
        hasBaseRecipe: true,
        maxServings: 0,
        trackStock: true,
        finishedGoodsQty: 32,
      }),
    ).toBe(0);
  });

  it("uses finished goods when tracked without recipe", () => {
    expect(
      displayProductListQty({
        hasBaseRecipe: false,
        maxServings: null,
        trackStock: true,
        finishedGoodsQty: 32,
      }),
    ).toBe(32);
  });

  it("returns null when untracked and no recipe servings", () => {
    expect(
      displayProductListQty({
        hasBaseRecipe: false,
        maxServings: null,
        trackStock: false,
        finishedGoodsQty: null,
      }),
    ).toBeNull();
  });
});

describe("productListStockModeLabel", () => {
  it("prefers menu recipe over tracked", () => {
    expect(productListStockModeLabel(true, true)).toBe("menuRecipe");
    expect(productListStockModeLabel(false, true)).toBe("tracked");
    expect(productListStockModeLabel(false, false)).toBe("untracked");
  });
});

describe("isRecipeDrivenOutOfStock", () => {
  it("is true when display sold_out comes from recipe not the POS flag", () => {
    expect(
      isRecipeDrivenOutOfStock({
        displayStatus: "sold_out",
        flagStatus: "available",
        hasBaseRecipe: true,
        maxServings: 0,
      }),
    ).toBe(true);
  });

  it("is false when the POS flag is already sold_out", () => {
    expect(
      isRecipeDrivenOutOfStock({
        displayStatus: "sold_out",
        flagStatus: "sold_out",
        hasBaseRecipe: true,
        maxServings: 0,
      }),
    ).toBe(false);
  });
});

describe("item inventory tracking predicates", () => {
  it("blocks starting item tracking when a base recipe exists", () => {
    expect(canStartItemInventoryTracking(true)).toBe(false);
    expect(canStartItemInventoryTracking(false)).toBe(true);
  });

  it("locks the track-stock checkbox when recipe exists or already saved tracked", () => {
    expect(lockItemTrackingCheckbox(false, true)).toBe(true);
    expect(lockItemTrackingCheckbox(true, false)).toBe(true);
    expect(lockItemTrackingCheckbox(false, false)).toBe(false);
  });
});
