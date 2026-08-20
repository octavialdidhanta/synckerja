import { describe, expect, it } from "vitest";
import type { CatalogIngredient } from "../../library/types";
import { formatRecipeCost, lineAvgCost, totalAvgCost } from "./productRecipeCost";

const milk: CatalogIngredient = {
  id: "i1",
  organization_id: "org",
  name: "Milk",
  kind: "raw",
  category_id: null,
  unit_code: "ml",
  track_inventory: true,
  sort_order: 1,
  photo_path: null,
  photo_url: null,
  outlet_ids: ["o1"],
  outlet_stocks: [
    {
      outlet_id: "o1",
      in_stock: 100,
      alert_enabled: false,
      alert_at: null,
      track_cogs: true,
      avg_cost: 3500,
    },
  ],
};

describe("lineAvgCost", () => {
  it("returns quantity times avg cost when COGS is tracked", () => {
    expect(lineAvgCost(milk, "o1", 2)).toBe(7000);
  });

  it("returns null when COGS is not tracked", () => {
    const row = {
      ...milk,
      outlet_stocks: [{ ...milk.outlet_stocks[0], track_cogs: false }],
    };
    expect(lineAvgCost(row, "o1", 2)).toBeNull();
  });
});

describe("totalAvgCost", () => {
  it("sums line costs", () => {
    const map = new Map([["i1", milk]]);
    expect(totalAvgCost([{ ingredient_id: "i1", quantity: 1 }], map, "o1")).toBe(3500);
  });
});

describe("formatRecipeCost", () => {
  it("formats rupiah or dash", () => {
    expect(formatRecipeCost(3500)).toContain("3");
    expect(formatRecipeCost(null)).toBe("—");
  });
});
