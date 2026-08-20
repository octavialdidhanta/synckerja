import { describe, expect, it } from "vitest";
import { groupAdjustmentMovements } from "./adjustmentGrouping";

describe("adjustmentGrouping", () => {
  it("groups movements by reference_id and sums qty_delta", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: "batch-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 1,
        qty_after: 501,
      },
      {
        id: "m2",
        reference_id: "batch-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:05:00.000Z",
        item_kind: "product",
        product_id: "p2",
        variant_id: "v1",
        ingredient_id: null,
        qty_delta: -2,
        qty_after: 498,
      },
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].referenceId).toBe("batch-1");
    expect(batches[0].itemKind).toBe("product");
    expect(batches[0].totalQtyDelta).toBe(-1);
    expect(batches[0].lines).toHaveLength(2);
  });

  it("falls back to movement id when reference_id is null", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: null,
        reference_type: null,
        note: null,
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 1,
        qty_after: 101,
      },
      {
        id: "m2",
        reference_id: null,
        reference_type: null,
        note: null,
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 2,
        qty_after: 102,
      },
    ]);
    expect(batches).toHaveLength(2);
  });

  it("groups ingredient movements by reference_id and sums qty_delta", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: "batch-ingredient-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "ingredient",
        product_id: null,
        variant_id: null,
        ingredient_id: "i1",
        qty_delta: 3,
        qty_after: 13,
      },
      {
        id: "m2",
        reference_id: "batch-ingredient-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:05:00.000Z",
        item_kind: "ingredient",
        product_id: null,
        variant_id: null,
        ingredient_id: "i2",
        qty_delta: -1,
        qty_after: 7,
      },
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].referenceId).toBe("batch-ingredient-1");
    expect(batches[0].itemKind).toBe("ingredient");
    expect(batches[0].totalQtyDelta).toBe(2);
    expect(batches[0].lines).toHaveLength(2);
  });
});

