import { describe, expect, it } from "vitest";
import type { CatalogIngredient } from "@/8-2-3-ingredient/library/types";
import {
  filterPosInventoryRows,
  POS_INVENTORY_FILTER_ALL,
} from "./filterPosInventoryRows";

function makeRow(
  partial: Partial<CatalogIngredient> & Pick<CatalogIngredient, "id" | "name">,
): CatalogIngredient {
  return {
    organization_id: "org",
    kind: "raw",
    category_id: null,
    unit_code: "g",
    track_inventory: true,
    sort_order: 0,
    photo_path: null,
    photo_url: null,
    outlet_ids: ["out-1"],
    outlet_stocks: [
      {
        outlet_id: "out-1",
        in_stock: 10,
        alert_enabled: true,
        alert_at: 5,
        track_cogs: false,
        avg_cost: 0,
      },
    ],
    ...partial,
  };
}

describe("filterPosInventoryRows", () => {
  const rows: CatalogIngredient[] = [
    makeRow({ id: "1", name: "Beras", kind: "raw", outlet_stocks: [
      { outlet_id: "out-1", in_stock: 100, alert_enabled: false, alert_at: null, track_cogs: false, avg_cost: 0 },
    ]}),
    makeRow({ id: "2", name: "Nasi", kind: "semi_finished", outlet_stocks: [
      { outlet_id: "out-1", in_stock: 2, alert_enabled: true, alert_at: 5, track_cogs: false, avg_cost: 0 },
    ]}),
    makeRow({ id: "3", name: "Gula", kind: "raw", outlet_stocks: [
      { outlet_id: "out-1", in_stock: 0, alert_enabled: true, alert_at: 1, track_cogs: false, avg_cost: 0 },
    ]}),
    makeRow({
      id: "4",
      name: "Garnish",
      track_inventory: false,
      outlet_stocks: [],
    }),
  ];

  it("hides untracked by default and sorts by name", () => {
    const result = filterPosInventoryRows({
      rows,
      outletId: "out-1",
      kind: POS_INVENTORY_FILTER_ALL,
      inventoryStatus: POS_INVENTORY_FILTER_ALL,
      search: "",
    });
    expect(result.map((r) => r.name)).toEqual(["Beras", "Gula", "Nasi"]);
  });

  it("filters by kind", () => {
    const result = filterPosInventoryRows({
      rows,
      outletId: "out-1",
      kind: "raw",
      inventoryStatus: POS_INVENTORY_FILTER_ALL,
      search: "",
    });
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("filters by search", () => {
    const result = filterPosInventoryRows({
      rows,
      outletId: "out-1",
      kind: POS_INVENTORY_FILTER_ALL,
      inventoryStatus: POS_INVENTORY_FILTER_ALL,
      search: "na",
    });
    expect(result.map((r) => r.name)).toEqual(["Nasi"]);
  });

  it("filters low and out stock", () => {
    const low = filterPosInventoryRows({
      rows,
      outletId: "out-1",
      kind: POS_INVENTORY_FILTER_ALL,
      inventoryStatus: "low",
      search: "",
    });
    expect(low.map((r) => r.name)).toEqual(["Nasi"]);

    const out = filterPosInventoryRows({
      rows,
      outletId: "out-1",
      kind: POS_INVENTORY_FILTER_ALL,
      inventoryStatus: "out",
      search: "",
    });
    expect(out.map((r) => r.name)).toEqual(["Gula"]);
  });
});
