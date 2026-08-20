import { describe, expect, it } from "vitest";
import { ingredientStockStatus } from "./ingredientStockStatus";
import type { CatalogIngredient } from "../types";

function ingredient(overrides: Partial<CatalogIngredient> = {}): CatalogIngredient {
  return {
    id: "ing-1",
    organization_id: "org-1",
    name: "telur",
    kind: "raw",
    category_id: null,
    unit_code: "pcs",
    track_inventory: true,
    sort_order: 1,
    outlet_ids: ["out-1"],
    outlet_stocks: [
      {
        outlet_id: "out-1",
        in_stock: 500,
        alert_enabled: true,
        alert_at: 10,
        track_cogs: true,
        avg_cost: 3500,
      },
    ],
    ...overrides,
  };
}

describe("ingredientStockStatus", () => {
  it("returns untracked when inventory is off", () => {
    expect(ingredientStockStatus(ingredient({ track_inventory: false }), "out-1")).toBe("untracked");
  });

  it("returns out when stock is zero", () => {
    expect(
      ingredientStockStatus(
        ingredient({
          outlet_stocks: [
            {
              outlet_id: "out-1",
              in_stock: 0,
              alert_enabled: true,
              alert_at: 10,
              track_cogs: false,
              avg_cost: 0,
            },
          ],
        }),
        "out-1",
      ),
    ).toBe("out");
  });

  it("returns low when stock is at or below alert", () => {
    expect(
      ingredientStockStatus(
        ingredient({
          outlet_stocks: [
            {
              outlet_id: "out-1",
              in_stock: 10,
              alert_enabled: true,
              alert_at: 10,
              track_cogs: false,
              avg_cost: 0,
            },
          ],
        }),
        "out-1",
      ),
    ).toBe("low");
  });

  it("returns ok when stock is above alert", () => {
    expect(ingredientStockStatus(ingredient(), "out-1")).toBe("ok");
  });
});
