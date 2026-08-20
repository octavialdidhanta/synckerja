import { describe, expect, it } from "vitest";
import { buildInventorySummaryLines, filterSummaryLines } from "./inventorySummaryMath";
import type { CatalogStockMovementRow, InventorySummaryStockItem } from "../types";

const period = {
  start: new Date("2026-08-20T00:00:00.000Z"),
  end: new Date("2026-08-20T23:59:59.999Z"),
};

const item: InventorySummaryStockItem = {
  itemKind: "product",
  productId: "p1",
  variantId: null,
  ingredientId: null,
  name: "Ayam Geprek",
  variantName: null,
  categoryName: "makanan",
  currentQty: 400,
  isParent: false,
};

function movement(partial: Partial<CatalogStockMovementRow>): CatalogStockMovementRow {
  return {
    id: "m",
    organization_id: "o",
    outlet_id: "out",
    item_kind: "product",
    product_id: "p1",
    variant_id: null,
    ingredient_id: null,
    movement_type: "sale",
    qty_delta: -100,
    qty_after: 400,
    occurred_at: "2026-08-20T12:00:00.000Z",
    ...partial,
  };
}

describe("buildInventorySummaryLines", () => {
  it("reconstructs beginning from current minus later deltas", () => {
    const lines = buildInventorySummaryLines({
      items: [item],
      movements: [movement({})],
      period,
    });
    expect(lines[0].beginning).toBe(500);
    expect(lines[0].sales).toBe(-100);
    expect(lines[0].ending).toBe(400);
    expect(lines[0].purchaseOrder).toBe(0);
    expect(lines[0].transfer).toBe(0);
  });

  it("counts adjustment movement into Adjustment column and reconstructs beginning/ending", () => {
    const currentQtyItem: InventorySummaryStockItem = {
      ...item,
      currentQty: 101,
    };
    const lines = buildInventorySummaryLines({
      items: [currentQtyItem],
      movements: [
        movement({
          movement_type: "adjustment",
          qty_delta: 1,
          qty_after: 101,
          occurred_at: "2026-08-20T12:00:00.000Z",
        }),
      ],
      period,
    });

    expect(lines[0].beginning).toBe(100);
    expect(lines[0].adjustment).toBe(1);
    expect(lines[0].ending).toBe(101);
    expect(lines[0].sales).toBe(0);
  });

  it("counts recipe consume in sales and opening in adjustment", () => {
    const ingredient: InventorySummaryStockItem = {
      ...item,
      itemKind: "ingredient",
      productId: null,
      ingredientId: "i1",
      name: "Ayam",
    };
    const lines = buildInventorySummaryLines({
      items: [ingredient],
      movements: [
        movement({
          item_kind: "ingredient",
          product_id: null,
          ingredient_id: "i1",
          movement_type: "opening",
          qty_delta: 10,
          occurred_at: "2026-08-20T01:00:00.000Z",
        }),
        movement({
          item_kind: "ingredient",
          product_id: null,
          ingredient_id: "i1",
          movement_type: "recipe_consume",
          qty_delta: -2,
          occurred_at: "2026-08-20T08:00:00.000Z",
        }),
      ],
      period,
    });
    expect(lines[0].adjustment).toBe(10);
    expect(lines[0].sales).toBe(-2);
  });

  it("leaves parent product rows blank", () => {
    const lines = buildInventorySummaryLines({
      items: [{ ...item, isParent: true, currentQty: 0 }],
      movements: [],
      period,
    });
    expect(lines[0].beginning).toBe(0);
    expect(lines[0].ending).toBe(0);
  });
});

describe("filterSummaryLines", () => {
  it("keeps parent when a variant name matches", () => {
    const parent: InventorySummaryLine = {
      ...item,
      isParent: true,
      variantId: null,
      beginning: 0,
      purchaseOrder: 0,
      sales: 0,
      transfer: 0,
      adjustment: 0,
      ending: 0,
    };
    const child: InventorySummaryLine = {
      ...item,
      isParent: false,
      variantId: "v1",
      variantName: "balado",
      beginning: 1,
      purchaseOrder: 0,
      sales: 0,
      transfer: 0,
      adjustment: 0,
      ending: 1,
    };
    expect(filterSummaryLines([parent, child], "balado").map((row) => row.variantId)).toEqual([null, "v1"]);
  });
});
